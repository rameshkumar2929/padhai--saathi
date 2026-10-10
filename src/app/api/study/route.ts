import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { chapters, questionSets, type Language, type Question } from "@/lib/study";

type Mode = "practice" | "simplify";
type ApiResult = { question?: Question; explanation?: string; fallback: boolean };
type RequestBody = { mode: Mode; language: Language; topic: string; family: string; grade: string };

const rateLimit = new Map<string, { count: number; resetsAt: number }>();
const responseCache = new Map<string, { result: ApiResult; expiresAt: number }>();
const WINDOW_MS = 60 * 60 * 1000;
const MAX_REQUESTS = 10;
const CACHE_MS = 15 * 60 * 1000;

function isLanguage(value: unknown): value is Language {
  return value === "en" || value === "hi" || value === "gu";
}

function isQuestion(value: unknown): value is Question {
  if (!value || typeof value !== "object") return false;
  const question = value as Record<string, unknown>;
  const triple = (item: unknown): item is [string, string, string] => Array.isArray(item) && item.length === 3 && item.every((part) => typeof part === "string" && part.length > 0 && part.length <= 240);
  return triple(question.p) && triple(question.e) && Number.isInteger(question.a) && (question.a as number) >= 0 && (question.a as number) < 4 && Array.isArray(question.o) && question.o.length === 4 && question.o.every(triple);
}

function fallback(body: RequestBody): ApiResult {
  const set = questionSets[body.family];
  if (body.mode === "simplify") return { explanation: set?.explanation[body.language === "gu" ? 2 : body.language === "hi" ? 1 : 0] ?? "Try the example again using smaller steps.", fallback: true };
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
  const language = body.language === "gu" ? "Gujarati" : body.language === "hi" ? "Hindi" : "English";
  const safety = `You are a kind Class ${body.grade} study helper. Topic: ${body.topic}. Use simple everyday examples suitable for rural students. Write in ${language}. Return ONLY a valid JSON object. No markdown.`;
  if (body.mode === "simplify") return `${safety} Give a short re-explanation in 3 to 5 small steps, under 120 words. JSON shape: {"explanation":"..."}`;
  return `${safety} Make exactly one fresh multiple choice question with 4 options and a short explanation. Provide all strings in English, Hindi, Gujarati, in that order. JSON shape: {"question":{"p":["en","hi","gu"],"o":[["en","hi","gu"],["en","hi","gu"],["en","hi","gu"],["en","hi","gu"]],"a":0,"e":["en","hi","gu"]}}. answer a must be 0, 1, 2, or 3.`;
}

async function generate(body: RequestBody, apiKey: string): Promise<ApiResult | null> {
  const endpoint = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: promptFor(body) }] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0.7, maxOutputTokens: 600 },
      }),
      signal: AbortSignal.timeout(4500),
      cache: "no-store",
    });
    if (!response.ok) return null;
    const payload = await response.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return null;
    try {
      const parsed = validateResult(parseModelText(text), body);
      if (parsed) return parsed;
    } catch {
      if (attempt === 1) return null;
    }
  }
  return null;
}

export async function POST(request: Request) {
  let unknownBody: unknown;
  try { unknownBody = await request.json(); } catch { return Response.json({ error: "Invalid request" }, { status: 400 }); }
  if (!unknownBody || typeof unknownBody !== "object") return Response.json({ error: "Invalid request" }, { status: 400 });
  const body = unknownBody as Partial<RequestBody>;
  const knownTopic = typeof body.family === "string" && typeof body.topic === "string" && chapters.some((chapter) => chapter.topics.some((topic) => topic.family === body.family && topic.title[0] === body.topic));
  if ((body.mode !== "practice" && body.mode !== "simplify") || !isLanguage(body.language) || typeof body.family !== "string" || !Object.hasOwn(questionSets, body.family) || !knownTopic || !["8", "9", "10"].includes(body.grade ?? "")) {
    return Response.json({ error: "Invalid study request" }, { status: 400 });
  }
  const validBody = body as RequestBody;
  const headersList = await headers();
  const ip = headersList.get("x-real-ip") ?? headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const cacheKey = createHash("sha256").update(JSON.stringify(validBody)).digest("hex");
  const cached = responseCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return Response.json(cached.result);
  const now = Date.now();
  const limit = rateLimit.get(ip);
  if (limit && limit.resetsAt > now && limit.count >= MAX_REQUESTS) {
    return Response.json({ ...fallback(validBody), message: "offline" }, { headers: { "Retry-After": String(Math.ceil((limit.resetsAt - now) / 1000)) } });
  }
  rateLimit.set(ip, !limit || limit.resetsAt <= now ? { count: 1, resetsAt: now + WINDOW_MS } : { ...limit, count: limit.count + 1 });
  if (rateLimit.size > 1000) {
    for (const [address, entry] of rateLimit) if (entry.resetsAt <= now) rateLimit.delete(address);
    if (rateLimit.size > 1000) rateLimit.delete(rateLimit.keys().next().value as string);
  }
  let result = fallback(validBody);
  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey) {
    try { result = await generate(validBody, apiKey) ?? result; } catch { result = fallback(validBody); }
  }
  responseCache.set(cacheKey, { result, expiresAt: now + CACHE_MS });
  if (responseCache.size > 250) {
    for (const [key, entry] of responseCache) if (entry.expiresAt <= now) responseCache.delete(key);
    if (responseCache.size > 250) responseCache.delete(responseCache.keys().next().value as string);
  }
  return Response.json(result);
}