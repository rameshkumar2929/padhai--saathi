import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { getLanguage, isLanguage, type Language } from "@/lib/languages";

type TranslationBody = { language: Language; texts: string[] };
type TranslationResult = { translations: string[]; fallback: boolean };

const rateLimit = new Map<string, { count: number; resetsAt: number }>();
const responseCache = new Map<string, { result: TranslationResult; expiresAt: number }>();
const WINDOW_MS = 60 * 60 * 1000;
const CACHE_MS = 24 * 60 * 60 * 1000;
const MAX_REQUESTS = 10;
const MAX_TEXTS = 40;

function parseJson(text: string): unknown {
  return JSON.parse(text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, ""));
}

function validateTranslations(value: unknown, count: number): string[] | null {
  if (!value || typeof value !== "object") return null;
  const translations = (value as { translations?: unknown }).translations;
  return Array.isArray(translations) && translations.length === count && translations.every((text) => typeof text === "string" && text.length > 0 && text.length <= 1200)
    ? translations
    : null;
}

async function translate(texts: string[], language: Language, apiKey: string): Promise<string[] | null> {
  const target = getLanguage(language);
  const endpoint = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";
  const prompt = `Translate each string in the JSON array into ${target.name} (${target.nativeName}). Keep math symbols, names, and meaning accurate for school students. Return ONLY JSON with exactly the same number of strings: {"translations":["..."]}. Input: ${JSON.stringify(texts)}`;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0.1, maxOutputTokens: 2400 },
      }),
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    if (!response.ok) return null;
    const payload = await response.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return null;
    try {
      const result = validateTranslations(parseJson(text), texts.length);
      if (result) return result;
    } catch {
      if (attempt === 1) return null;
    }
  }
  return null;
}

export async function POST(request: Request) {
  let input: unknown;
  try { input = await request.json(); } catch { return Response.json({ error: "Invalid request" }, { status: 400 }); }
  if (!input || typeof input !== "object") return Response.json({ error: "Invalid request" }, { status: 400 });
  const body = input as Partial<TranslationBody>;
  if (!isLanguage(body.language) || ["en", "hi", "gu"].includes(body.language) || !Array.isArray(body.texts) || body.texts.length < 1 || body.texts.length > MAX_TEXTS || !body.texts.every((text) => typeof text === "string" && text.length > 0 && text.length <= 700)) {
    return Response.json({ error: "Invalid translation request" }, { status: 400 });
  }

  const texts = [...new Set(body.texts)];
  const cacheKey = createHash("sha256").update(JSON.stringify([body.language, texts])).digest("hex");
  const cached = responseCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return Response.json(cached.result);

  const headersList = await headers();
  const ip = headersList.get("x-real-ip") ?? headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const now = Date.now();
  const limit = rateLimit.get(ip);
  if (limit && limit.resetsAt > now && limit.count >= MAX_REQUESTS) {
    return Response.json({ translations: [], fallback: true }, { headers: { "Retry-After": String(Math.ceil((limit.resetsAt - now) / 1000)) } });
  }
  rateLimit.set(ip, !limit || limit.resetsAt <= now ? { count: 1, resetsAt: now + WINDOW_MS } : { ...limit, count: limit.count + 1 });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return Response.json({ translations: [], fallback: true });
  try {
    const translations = await translate(texts, body.language, apiKey);
    if (!translations) return Response.json({ translations: [], fallback: true });
    const result = { translations, fallback: false };
    responseCache.set(cacheKey, { result, expiresAt: now + CACHE_MS });
    if (responseCache.size > 250) {
      for (const [key, entry] of responseCache) if (entry.expiresAt <= now) responseCache.delete(key);
      if (responseCache.size > 250) responseCache.delete(responseCache.keys().next().value as string);
    }
    return Response.json(result);
  } catch {
    return Response.json({ translations: [], fallback: true });
  }
}
