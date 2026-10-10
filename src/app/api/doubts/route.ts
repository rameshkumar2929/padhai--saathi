import { createHash, timingSafeEqual } from "node:crypto";
import { headers } from "next/headers";
import { getLanguage, isLanguage, type Language } from "@/lib/languages";

type DoubtBody = {
  language: Language;
  grade: string;
  subject: "math" | "science";
  question: string;
  nickname?: string;
  lowData?: boolean;
  showSolution?: boolean;
  image?: { mimeType: string; data: string };
};
type DoubtAnswer = { answer: string; followUp: string; fallback: boolean };

const rateLimit = new Map<string, { count: number; resetsAt: number }>();
const responseCache = new Map<string, { result: DoubtAnswer; expiresAt: number }>();
const WINDOW_MS = 60 * 60 * 1000;
const CACHE_MS = 15 * 60 * 1000;
const MAX_REQUESTS = 10;
const friendlyFallback: DoubtAnswer = {
  answer: "Saathi needs an internet connection and an active AI service to answer a new doubt. You can still study and practise from the built-in question bank.",
  followUp: "Which maths or science topic are you working on?",
  fallback: true,
};

function isDoubtBody(value: unknown): value is DoubtBody {
  if (!value || typeof value !== "object") return false;
  const body = value as Record<string, unknown>;
  if (!isLanguage(body.language) || !["8", "9", "10"].includes(String(body.grade)) || !["math", "science"].includes(String(body.subject))) return false;
  if (typeof body.question !== "string" || body.question.trim().length < 2 || body.question.length > 1200) return false;
  if (body.nickname !== undefined && (typeof body.nickname !== "string" || body.nickname.length > 24)) return false;
  if (body.lowData !== undefined && typeof body.lowData !== "boolean") return false;
  if (body.image === undefined) return true;
  if (!body.image || typeof body.image !== "object") return false;
  const image = body.image as Record<string, unknown>;
  return typeof image.mimeType === "string" && ["image/jpeg", "image/png", "image/webp"].includes(image.mimeType)
    && typeof image.data === "string" && image.data.length > 0 && image.data.length <= 3_200_000;
}

function supabaseConfig() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? { url, key } : null;
}

function hasTeacherAccess(request: Request) {
  const expected = process.env.TEACHER_ACCESS_TOKEN;
  const provided = request.headers.get("x-teacher-token") ?? "";
  if (!expected || !provided) return false;
  const expectedBytes = Buffer.from(expected);
  const providedBytes = Buffer.from(provided);
  return expectedBytes.length === providedBytes.length && timingSafeEqual(expectedBytes, providedBytes);
}

async function saveRemoteDoubt(body: DoubtBody, answer: DoubtAnswer) {
  const config = supabaseConfig();
  if (!config) return;
  await fetch(`${config.url}/rest/v1/student_doubts`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: config.key, Authorization: `Bearer ${config.key}`, Prefer: "return=minimal" },
    body: JSON.stringify({
      nickname: body.nickname?.trim() || "Student",
      grade: body.grade,
      subject: body.subject,
      question: body.question.slice(0, 1200),
      answer: answer.answer.slice(0, 2400),
      status: "new",
    }),
    signal: AbortSignal.timeout(3500),
    cache: "no-store",
  });
}

function parseJson(text: string): unknown {
  return JSON.parse(text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, ""));
}

function validateAnswer(value: unknown): Omit<DoubtAnswer, "fallback"> | null {
  if (!value || typeof value !== "object") return null;
  const answer = value as Record<string, unknown>;
  return typeof answer.answer === "string" && answer.answer.length >= 10 && answer.answer.length <= 2400
    && typeof answer.followUp === "string" && answer.followUp.length <= 300
    ? { answer: answer.answer, followUp: answer.followUp }
    : null;
}

async function generate(body: DoubtBody, apiKey: string): Promise<Omit<DoubtAnswer, "fallback"> | null> {
  const language = getLanguage(body.language);
  const length = body.lowData ? "Keep the answer very short." : "Use a few simple steps.";
  const safety = `You are Padhai Saathi, a kind school study helper for a Class ${body.grade} student studying ${body.subject === "math" ? "Maths" : "Science"}. Reply in ${language.name} (${language.nativeName}) using short, age-appropriate steps and everyday examples. ${length} Only help with school Maths or Science. Politely refuse unsafe, abusive, personal, or unrelated requests; never ask for a real name, phone, email, address, password, or other personal details. Say that answers can be mistaken and important work should be checked with a teacher. For homework-like problems give a helpful hint first unless the student explicitly asks for the full solution. End with one short follow-up question. Return only JSON: {"answer":"...","followUp":"..."}.`;
  const prompt = `${safety}\nStudent's doubt: ${body.question}\n${body.showSolution ? "The student asked to see the full solution; explain it step by step." : "Give a hint before any full worked answer."}`;
  const parts: Record<string, unknown>[] = [{ text: prompt }];
  if (body.image) parts.push({ inlineData: { mimeType: body.image.mimeType, data: body.image.data } });
  const endpoint = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        generationConfig: { responseMimeType: "application/json", temperature: 0.4, maxOutputTokens: 900 },
      }),
      signal: AbortSignal.timeout(9000),
      cache: "no-store",
    });
    if (!response.ok) return null;
    const payload = await response.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return null;
    try {
      const result = validateAnswer(parseJson(text));
      if (result) return result;
    } catch {
      if (attempt === 1) return null;
    }
  }
  return null;
}

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 4_500_000) return Response.json({ error: "Image is too large. Try a smaller photo." }, { status: 413 });
  let value: unknown;
  try { value = await request.json(); } catch { return Response.json({ error: "Invalid request" }, { status: 400 }); }
  if (!isDoubtBody(value)) return Response.json({ error: "Add a short Maths or Science question and try again." }, { status: 400 });

  const body = value;
  const cacheKey = createHash("sha256").update(JSON.stringify(body)).digest("hex");
  const cached = responseCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return Response.json(cached.result);

  const headersList = await headers();
  const ip = headersList.get("x-real-ip") ?? headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const now = Date.now();
  const limit = rateLimit.get(ip);
  if (limit && limit.resetsAt > now && limit.count >= MAX_REQUESTS) {
    return Response.json({ ...friendlyFallback, fallback: true }, { status: 429, headers: { "Retry-After": String(Math.ceil((limit.resetsAt - now) / 1000)) } });
  }
  rateLimit.set(ip, !limit || limit.resetsAt <= now ? { count: 1, resetsAt: now + WINDOW_MS } : { ...limit, count: limit.count + 1 });
  if (rateLimit.size > 1000) {
    for (const [address, entry] of rateLimit) if (entry.resetsAt <= now) rateLimit.delete(address);
    if (rateLimit.size > 1000) rateLimit.delete(rateLimit.keys().next().value as string);
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    try { await saveRemoteDoubt(body, friendlyFallback); } catch { /* Keep the local fallback available when optional storage is down. */ }
    return Response.json(friendlyFallback);
  }
  try {
    const generated = await generate(body, apiKey);
    const result: DoubtAnswer = generated ? { ...generated, fallback: false } : friendlyFallback;
    try { await saveRemoteDoubt(body, result); } catch { /* Supabase is optional; answers remain available locally. */ }
    if (!generated) return Response.json(result);
    responseCache.set(cacheKey, { result, expiresAt: now + CACHE_MS });
    if (responseCache.size > 250) {
      for (const [key, entry] of responseCache) if (entry.expiresAt <= now) responseCache.delete(key);
      if (responseCache.size > 250) responseCache.delete(responseCache.keys().next().value as string);
    }
    return Response.json(result);
  } catch {
    try { await saveRemoteDoubt(body, friendlyFallback); } catch { /* Keep the local fallback available when optional storage is down. */ }
    return Response.json(friendlyFallback);
  }
}

export async function GET(request: Request) {
  const config = supabaseConfig();
  if (!config) return Response.json({ configured: false, doubts: [] });
  if (!hasTeacherAccess(request)) return Response.json({ error: "Enter the teacher access code to view shared doubts." }, { status: 401 });
  try {
    const response = await fetch(`${config.url}/rest/v1/student_doubts?select=id,nickname,grade,subject,question,answer,status,created_at&order=created_at.desc&limit=100`, {
      headers: { apikey: config.key, Authorization: `Bearer ${config.key}` },
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
    });
    if (!response.ok) return Response.json({ error: "Teacher doubts are temporarily unavailable." }, { status: 502 });
    return Response.json({ configured: true, doubts: await response.json() });
  } catch {
    return Response.json({ error: "Teacher doubts are temporarily unavailable." }, { status: 502 });
  }
}

export async function PATCH(request: Request) {
  const config = supabaseConfig();
  if (!config) return Response.json({ error: "Shared teacher storage is not configured." }, { status: 503 });
  if (!hasTeacherAccess(request)) return Response.json({ error: "Teacher access is required." }, { status: 401 });
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid request" }, { status: 400 }); }
  if (!body || typeof body !== "object" || typeof (body as { id?: unknown }).id !== "string" || (body as { id: string }).id.length > 80) {
    return Response.json({ error: "Invalid doubt id." }, { status: 400 });
  }
  try {
    const response = await fetch(`${config.url}/rest/v1/student_doubts?id=eq.${encodeURIComponent((body as { id: string }).id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", apikey: config.key, Authorization: `Bearer ${config.key}`, Prefer: "return=minimal" },
      body: JSON.stringify({ status: "answered" }),
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
    });
    if (!response.ok) return Response.json({ error: "That doubt could not be updated." }, { status: 502 });
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "That doubt could not be updated." }, { status: 502 });
  }
}
