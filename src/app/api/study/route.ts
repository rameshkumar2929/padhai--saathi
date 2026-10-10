import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { coreLanguage, getLanguage, isLanguage } from "@/lib/languages";
import { chapters, questionSets, type Language, type Question } from "@/lib/study";

type Mode = "practice" | "simplify";
type ApiResult = { question?: Question; explanation?: string; fallback: boolean };
type RequestBody = { mode: Mode; language: Language; topic: string; family: string; grade: string; lowData?: boolean };
type ProviderError = { code: string; category: string; recovery: string; upstreamStatus?: number };
type Generation = { result: ApiResult | null; error?: ProviderError };

const rateLimit = new Map<string, { count: number; resetsAt: number }>();
const responseCache = new Map<string, { result: ApiResult; expiresAt: number }>();
const WINDOW_MS = 60 * 60 * 1000;
const MAX_REQUESTS = 10;
const CACHE_MS = 15 * 60 * 1000;

function classifyProviderError(status: number, upstreamMessage = ""): ProviderError {
  const message = upstreamMessage.toLowerCase();
  if ([400, 401, 403].includes(status) || message.includes("api key")) {
    return { code: "GEMINI_AUTH", category: "Gemini rejected the API key or request", recovery: "Check that GEMINI_API_KEY is valid and enabled for the Generative Language API, then redeploy.", upstreamStatus: status };
  }
  if (status === 429) return { code: "GEMINI_QUOTA", category: "Gemini free-tier quota or rate limit reached", recovery: "Wait for the quota window to reset, or check the Google AI Studio quota for this key.", upstreamStatus: status };
  if (status >= 500) return { code: "GEMINI_UNAVAILABLE", category: "Google Gemini is temporarily unavailable", recovery: "Retry in a moment. Built-in study questions remain available.", upstreamStatus: status };
  return { code: "GEMINI_REQUEST", category: "Gemini rejected this request", recovery: "Check the model and request configuration. Built-in study content remains available.", upstreamStatus: status };
}

async function readUpstreamError(response: Response): Promise<string> {
  try {
    const payload = await response.json() as { error?: { message?: string } };
    return typeof payload.error?.message === "string" ? payload.error.message.slice(0, 240) : "";
  } catch {
    return "";
  }
}

function isQuestion(value: unknown): value is Question {
  if (!value || typeof value !== "object") return false;
  const question = value as Record<string, unknown>;
  const triple = (item: unknown): item is [string, string, string] => Array.isArray(item) && item.length === 3 && item.every((part) => typeof part === "string" && part.length > 0 && part.length <= 240);
  return triple(question.p) && triple(question.e) && Number.isInteger(question.a) && (question.a as number) >= 0 && (question.a as number) < 4 && Array.isArray(question.o) && question.o.length === 4 && question.o.every(triple);
}

function fallback(body: RequestBody): ApiResult {
  const set = questionSets[body.family];
  if (body.mode === "simplify") return { explanation: set?.explanation[coreLanguage(body.language) === "gu" ? 2 : coreLanguage(body.language) === "hi" ? 1 : 0] ?? "Try the example again using smaller steps.", fallback: true };
  const question = set?.questions[Math.floor(Math.random() * (set.questions.length || 1))];
  return { question, fallback: true };
}

function parseModelText(text: string): unknown {
  return JSON.parse(text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, ""));
}

function validateResult(value: unknown, body: RequestBody): ApiResult | null {
  if (!value || typeof value !== "object") return null;
  const data = value as Record<string, unknown>;
  if (body.mode === "simplify") {
    return typeof data.explanation === "string" && data.explanation.length >= 20 && data.explanation.length <= 700
      ? { explanation: data.explanation, fallback: false }
      : null;
  }
  return isQuestion(data.question) ? { question: data.question, fallback: false } : null;
}

function promptFor(body: RequestBody) {
  const language = getLanguage(body.language).name;
  const length = body.lowData ? "Keep the answer very short, under 50 words." : "Use a few simple steps.";
  const safety = `You are a kind Class ${body.grade} study helper. Topic: ${body.topic}. Use simple everyday examples suitable for rural students. Write in ${language}. ${length} Return ONLY a valid JSON object. No markdown.`;
  if (body.mode === "simplify") return `${safety} Give a short re-explanation in 3 to 5 small steps, under 120 words. JSON shape: {"explanation":"..."}`;
  const languages = ["en", "hi", "gu"].includes(body.language)
    ? "Provide each string in English, Hindi, and Gujarati, in that order."
    : `Write every string in ${language} and repeat that same translation in all three string slots.`;
  return `${safety} Make exactly one fresh multiple choice question with 4 options and a short explanation. ${languages} JSON shape: {"question":{"p":["en","hi","gu"],"o":[["en","hi","gu"],["en","hi","gu"],["en","hi","gu"],["en","hi","gu"]],"a":0,"e":["en","hi","gu"]}}. answer a must be 0, 1, 2, or 3.`;
}

async function generate(body: RequestBody, apiKey: string): Promise<Generation> {
  const endpoint = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: promptFor(body) }] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0.7, maxOutputTokens: 600 },
      }),
      signal: AbortSignal.timeout(12000),
      cache: "no-store",
    });
    if (!response.ok) {
      const error = classifyProviderError(response.status, await readUpstreamError(response));
      console.error("Gemini request failed", { code: error.code, status: response.status });
      return { result: null, error };
    }
    let payload: { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    try {
      payload = await response.json() as typeof payload;
    } catch {
      return { result: null, error: { code: "GEMINI_INVALID_RESPONSE", category: "Gemini returned unreadable JSON", recovery: "Retry the request. If it repeats, check the configured model and API status." } };
    }
    const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return { result: null, error: { code: "GEMINI_EMPTY_RESPONSE", category: "Gemini returned no generated content", recovery: "Retry once. Built-in study content remains available." } };
    try {
      const parsed = validateResult(parseModelText(text), body);
      if (parsed) return { result: parsed };
    } catch {
      if (attempt === 1) return { result: null, error: { code: "GEMINI_INVALID_JSON", category: "Gemini response did not match the required study format", recovery: "Retry the action. Use the built-in question bank while the AI response format is reviewed." } };
    }
  }
  return { result: null, error: { code: "GEMINI_INVALID_RESULT", category: "Gemini response failed validation", recovery: "Retry the action. Built-in study content remains available." } };
}

export async function GET() {
  return Response.json({ provider: "Google Gemini", model: "gemini-2.5-flash", configured: Boolean(process.env.GEMINI_API_KEY) });
}

export async function POST(request: Request) {
  let unknownBody: unknown;
  try { unknownBody = await request.json(); } catch { return Response.json({ error: "Invalid request" }, { status: 400 }); }
  if (!unknownBody || typeof unknownBody !== "object") return Response.json({ error: "Invalid request" }, { status: 400 });
  const body = unknownBody as Partial<RequestBody>;
  const knownTopic = typeof body.family === "string" && typeof body.topic === "string" && chapters.some((chapter) => chapter.topics.some((topic) => topic.family === body.family && topic.title[0] === body.topic));
  if ((body.mode !== "practice" && body.mode !== "simplify") || !isLanguage(body.language) || typeof body.family !== "string" || !Object.hasOwn(questionSets, body.family) || !knownTopic || !["8", "9", "10"].includes(body.grade ?? "") || (body.lowData !== undefined && typeof body.lowData !== "boolean")) {
    return Response.json({ error: "Invalid study request" }, { status: 400 });
  }
  const validBody = body as RequestBody;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    const error: ProviderError = { code: "GEMINI_NOT_CONFIGURED", category: "Gemini is not configured on this deployment", recovery: "Add GEMINI_API_KEY to the server environment and redeploy. The built-in question bank remains available." };
    return Response.json({ ...fallback(validBody), providerError: error });
  }
  const headersList = await headers();
  const ip = headersList.get("x-real-ip") ?? headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const cacheKey = createHash("sha256").update(JSON.stringify(validBody)).digest("hex");
  const cached = responseCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return Response.json(cached.result);
  const now = Date.now();
  const limit = rateLimit.get(ip);
  if (limit && limit.resetsAt > now && limit.count >= MAX_REQUESTS) {
    const error: ProviderError = { code: "APP_RATE_LIMIT", category: "Padhai Saathi request limit reached", recovery: "Wait until the retry window ends, or continue with the built-in question bank." };
    return Response.json({ ...fallback(validBody), providerError: error }, { status: 429, headers: { "Retry-After": String(Math.ceil((limit.resetsAt - now) / 1000)) } });
  }
  rateLimit.set(ip, !limit || limit.resetsAt <= now ? { count: 1, resetsAt: now + WINDOW_MS } : { ...limit, count: limit.count + 1 });
  if (rateLimit.size > 1000) {
    for (const [address, entry] of rateLimit) if (entry.resetsAt <= now) rateLimit.delete(address);
    if (rateLimit.size > 1000) rateLimit.delete(rateLimit.keys().next().value as string);
  }
  let generated: Generation;
  try {
    generated = await generate(validBody, apiKey);
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    generated = { result: null, error: timedOut
      ? { code: "GEMINI_TIMEOUT", category: "Gemini did not respond before the request timed out", recovery: "Retry on a steadier connection. Built-in questions are available in the meantime." }
      : { code: "GEMINI_NETWORK", category: "Padhai Saathi could not reach Gemini", recovery: "Check the deployment's outbound network and try again." } };
    console.error("Gemini transport failed", { code: generated.error?.code });
  }
  const result = generated.result ?? fallback(validBody);
  if (generated.result) {
    responseCache.set(cacheKey, { result, expiresAt: now + CACHE_MS });
    if (responseCache.size > 250) {
      for (const [key, entry] of responseCache) if (entry.expiresAt <= now) responseCache.delete(key);
      if (responseCache.size > 250) responseCache.delete(responseCache.keys().next().value as string);
    }
  }
  return Response.json({ ...result, ...(generated.error ? { providerError: generated.error } : {}) });
}