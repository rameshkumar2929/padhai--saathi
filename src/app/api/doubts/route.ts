
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

type DoubtAnswer = {
  answer: string;
  followUp: string;
  fallback: boolean;
};

type GeneratedAnswer = Omit<DoubtAnswer, "fallback">;

type GeminiPayload = {
  candidates?: {
    content?: { parts?: { text?: string }[] };
    finishReason?: string;
  }[];
  promptFeedback?: { blockReason?: string };
  error?: { message?: string };
};

const rateLimit = new Map<string, { count: number; resetsAt: number }>();
const responseCache = new Map<
  string,
  { result: DoubtAnswer; expiresAt: number }
>();

const WINDOW_MS = 60 * 60 * 1000;
const CACHE_MS = 15 * 60 * 1000;
const MAX_REQUESTS = 10;
const MAX_IMAGE_LENGTH = 3_200_000;
const MAX_QUESTION_LENGTH = 1200;

const friendlyFallback: DoubtAnswer = {
  answer:
    "Saathi could not get an answer from the AI service right now. Please try again in a moment. You can also practise using your textbook or ask your teacher for help.",
  followUp: "Which Maths or Science topic are you working on?",
  fallback: true,
};

function isDoubtBody(value: unknown): value is DoubtBody {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const body = value as Record<string, unknown>;

  if (
    !isLanguage(body.language) ||
    !["8", "9", "10"].includes(String(body.grade)) ||
    !["math", "science"].includes(String(body.subject))
  ) {
    return false;
  }

  if (
    typeof body.question !== "string" ||
    body.question.trim().length < 2 ||
    body.question.length > MAX_QUESTION_LENGTH
  ) {
    return false;
  }

  if (
    body.nickname !== undefined &&
    (typeof body.nickname !== "string" || body.nickname.length > 24)
  ) {
    return false;
  }

  if (
    body.lowData !== undefined &&
    typeof body.lowData !== "boolean"
  ) {
    return false;
  }

  if (
    body.showSolution !== undefined &&
    typeof body.showSolution !== "boolean"
  ) {
    return false;
  }

  if (body.image === undefined) return true;

  if (
    !body.image ||
    typeof body.image !== "object" ||
    Array.isArray(body.image)
  ) {
    return false;
  }

  const image = body.image as Record<string, unknown>;

  return (
    typeof image.mimeType === "string" &&
    ["image/jpeg", "image/png", "image/webp"].includes(image.mimeType) &&
    typeof image.data === "string" &&
    image.data.length > 0 &&
    image.data.length <= MAX_IMAGE_LENGTH &&
    /^[A-Za-z0-9+/]*={0,2}$/.test(image.data)
  );
}

function supabaseConfig(): { url: string; key: string } | null {
  const rawUrl = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!rawUrl || !key) return null;

  try {
    const parsed = new URL(rawUrl);

    if (
      parsed.protocol !== "https:" &&
      parsed.hostname !== "localhost" &&
      parsed.hostname !== "127.0.0.1"
    ) {
      return null;
    }

    return {
      url: parsed.origin.replace(/\/+$/, ""),
      key,
    };
  } catch {
    return null;
  }
}

function hasTeacherAccess(request: Request): boolean {
  const expected = process.env.TEACHER_ACCESS_TOKEN;
  const provided = request.headers.get("x-teacher-token") ?? "";

  if (!expected || !provided) return false;

  const expectedBytes = Buffer.from(expected);
  const providedBytes = Buffer.from(provided);

  return (
    expectedBytes.length === providedBytes.length &&
    timingSafeEqual(expectedBytes, providedBytes)
  );
}

async function saveRemoteDoubt(
  body: DoubtBody,
  answer: DoubtAnswer,
): Promise<void> {
  const config = supabaseConfig();
  if (!config) return;

  try {
    const response = await fetch(
      config.url + "/rest/v1/student_doubts",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: config.key,
          Authorization: "Bearer " + config.key,
          Prefer: "return=minimal",
        },
        body: JSON.stringify({
          nickname: body.nickname?.trim() || "Student",
          grade: body.grade,
          subject: body.subject,
          question: body.question.slice(0, MAX_QUESTION_LENGTH),
          answer: answer.answer.slice(0, 2400),
          status: "new",
        }),
        signal: AbortSignal.timeout(3500),
        cache: "no-store",
      },
    );

    if (!response.ok) {
      console.error("Supabase save failed. HTTP status:", response.status);
    }
  } catch (error) {
    console.error(
      "Optional Supabase save failed:",
      error instanceof Error ? error.message : "Unknown error",
    );
  }
}

/**
 * Parse JSON returned by Gemini.
 * Accepts plain JSON or JSON enclosed in Markdown code fences.
 * Invalid or incomplete JSON is rejected instead of being guessed.
 */
function parseJson(text: string): unknown {
  let cleaned = text.trim();

  cleaned = cleaned.replace(/^```(?:json)?\s*/i, "");
  cleaned = cleaned.replace(/\s*```\s*$/, "");
  cleaned = cleaned.trim();

  return JSON.parse(cleaned);
}

function validateAnswer(value: unknown): GeneratedAnswer | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const answer = value as Record<string, unknown>;

  if (
    typeof answer.answer !== "string" ||
    answer.answer.trim().length < 10 ||
    answer.answer.length > 2400 ||
    typeof answer.followUp !== "string" ||
    answer.followUp.trim().length > 300
  ) {
    return null;
  }

  return {
    answer: answer.answer.trim(),
    followUp: answer.followUp.trim(),
  };
}

async function generate(
  body: DoubtBody,
  apiKey: string,
): Promise<GeneratedAnswer | null> {
  const language = getLanguage(body.language);

  const lengthInstruction = body.lowData
    ? "Keep the answer concise and use minimal tokens."
    : "Explain using simple steps and one relevant example.";

  const instructions =
    "You are Padhai Saathi, a friendly school study assistant. " +
    "The student is in Class " +
    body.grade +
    " and is studying " +
    (body.subject === "math" ? "Maths" : "Science") +
    ". Answer in " +
    language.name +
    " (" +
    language.nativeName +
    "). " +
    "Use age-appropriate explanations and everyday examples. " +
    lengthInstruction +
    " Only answer school Maths and Science questions. " +
    "Politely decline unrelated or unsafe requests. " +
    "Do not ask for personal information. " +
    "Encourage the student to check important work with a teacher. " +
    (body.showSolution
      ? "Give a complete solution with numbered, clear steps."
      : "Start with a useful hint and explain the solution when appropriate.") +
    " Return a JSON object containing exactly two string fields: " +
    "answer and followUp. Keep the followUp to one short question. " +
    "Do not include Markdown fences or any text outside the JSON object.";

  const parts: Record<string, unknown>[] = [
    {
      text:
        instructions +
        "\n\nStudent question:\n" +
        body.question.trim(),
    },
  ];

  if (body.image) {
    parts.push({
      inlineData: {
        mimeType: body.image.mimeType,
        data: body.image.data,
      },
    });
  }

  const endpoint =
    "https://generativelanguage.googleapis.com/v1beta/models/" +
    "gemini-flash-latest:generateContent";

  for (let attempt = 0; attempt < 2; attempt++) {
    let response: Response;

    try {
      response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [{ role: "user", parts }],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: {
              type: "OBJECT",
              properties: {
                answer: { type: "STRING" },
                followUp: { type: "STRING" },
              },
              required: ["answer", "followUp"],
            },
            temperature: 0.2,
            maxOutputTokens: 1600,
          },
        }),
        signal: AbortSignal.timeout(25000),
        cache: "no-store",
      });
    } catch (error) {
      console.error("Gemini network request failed:", {
        message: error instanceof Error ? error.message : "Unknown error",
        attempt: attempt + 1,
      });

      if (attempt === 0) continue;
      return null;
    }

    if (!response.ok) {
      // Do not log response bodies because they may contain sensitive details.
      console.error("Gemini API HTTP error:", {
        status: response.status,
        attempt: attempt + 1,
      });

      if (
        attempt === 0 &&
        (response.status === 429 || response.status >= 500)
      ) {
        continue;
      }

      return null;
    }

    let payload: GeminiPayload;

    try {
      payload = (await response.json()) as GeminiPayload;
    } catch {
      console.error("Gemini returned an invalid response body.");
      if (attempt === 0) continue;
      return null;
    }

    const candidate = payload.candidates?.[0];
    const text = candidate?.content?.parts
      ?.map((part) => part.text ?? "")
      .join("")
      .trim();

    if (!text) {
      console.error("Gemini returned no answer text:", {
        finishReason: candidate?.finishReason,
        blockReason: payload.promptFeedback?.blockReason,
        attempt: attempt + 1,
      });

      if (attempt === 0) continue;
      return null;
    }

    try {
      const result = validateAnswer(parseJson(text));

      if (result) {
        return result;
      }

      console.error("Gemini answer failed validation:", {
        finishReason: candidate?.finishReason,
        responseLength: text.length,
        attempt: attempt + 1,
      });
    } catch (error) {
      console.error("Gemini JSON parsing failed:", {
        message: error instanceof Error ? error.message : "Invalid JSON",
        finishReason: candidate?.finishReason,
        responseLength: text.length,
        attempt: attempt + 1,
      });
    }

    // Retry once if the response was malformed or failed validation.
  }

  return null;
}

function pruneMaps(now: number): void {
  for (const [key, entry] of responseCache) {
    if (entry.expiresAt <= now) responseCache.delete(key);
  }

  for (const [key, entry] of rateLimit) {
    if (entry.resetsAt <= now) rateLimit.delete(key);
  }

  while (responseCache.size > 250) {
    const oldestKey = responseCache.keys().next().value;
    if (oldestKey === undefined) break;
    responseCache.delete(oldestKey);
  }

  while (rateLimit.size > 1000) {
    const oldestKey = rateLimit.keys().next().value;
    if (oldestKey === undefined) break;
    rateLimit.delete(oldestKey);
  }
}

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") ?? 0);

  if (Number.isFinite(contentLength) && contentLength > 4_500_000) {
    return Response.json(
      { error: "Image is too large. Try a smaller photo." },
      { status: 413 },
    );
  }

  let value: unknown;

  try {
    value = await request.json();
  } catch {
    return Response.json({ error: "Invalid request JSON." }, { status: 400 });
  }

  if (!isDoubtBody(value)) {
    return Response.json(
      {
        error:
          "Add a valid Class 8-10 Maths or Science question and try again.",
      },
      { status: 400 },
    );
  }

  const body = value;
  const now = Date.now();

  pruneMaps(now);

  const cacheKey = createHash("sha256")
    .update(JSON.stringify(body))
    .digest("hex");

  const cached = responseCache.get(cacheKey);

  if (cached && cached.expiresAt > now) {
    return Response.json(cached.result);
  }

  const requestHeaders = await headers();

  const ip =
    requestHeaders.get("x-real-ip") ??
    requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown";

  const limit = rateLimit.get(ip);

  if (limit && limit.resetsAt > now && limit.count >= MAX_REQUESTS) {
    return Response.json(
      {
        error: "Too many questions. Please try again later.",
        ...friendlyFallback,
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(
            Math.max(1, Math.ceil((limit.resetsAt - now) / 1000)),
          ),
        },
      },
    );
  }

  rateLimit.set(
    ip,
    !limit || limit.resetsAt <= now
      ? { count: 1, resetsAt: now + WINDOW_MS }
      : { ...limit, count: limit.count + 1 },
  );

  const apiKey = process.env.GEMINI_API_KEY?.trim();

  if (!apiKey) {
    console.error("GEMINI_API_KEY is missing from the server environment.");
    return Response.json(friendlyFallback);
  }

  let generated: GeneratedAnswer | null = null;

  try {
    generated = await generate(body, apiKey);
  } catch (error) {
    console.error(
      "Doubt generation failed:",
      error instanceof Error ? error.message : "Unknown error",
    );
  }

  const result: DoubtAnswer = generated
    ? { ...generated, fallback: false }
    : friendlyFallback;

  // Supabase is optional and must not prevent the answer from being returned.
  await saveRemoteDoubt(body, result);

  if (!generated) {
    return Response.json(result);
  }

  responseCache.set(cacheKey, {
    result,
    expiresAt: now + CACHE_MS,
  });

  pruneMaps(Date.now());

  return Response.json(result);
}

export async function GET(request: Request) {
  const config = supabaseConfig();

  if (!config) {
    return Response.json({ configured: false, doubts: [] });
  }

  if (!hasTeacherAccess(request)) {
    return Response.json(
      { error: "Enter the teacher access code to view shared doubts." },
      { status: 401 },
    );
  }

  try {
    const response = await fetch(
      config.url +
        "/rest/v1/student_doubts?select=id,nickname,grade,subject,question,answer,status,created_at&order=created_at.desc&limit=100",
      {
        headers: {
          apikey: config.key,
          Authorization: "Bearer " + config.key,
        },
        signal: AbortSignal.timeout(5000),
        cache: "no-store",
      },
    );

    if (!response.ok) {
      console.error("Supabase teacher GET failed:", response.status);

      return Response.json(
        { error: "Teacher doubts are temporarily unavailable." },
        { status: 502 },
      );
    }

    return Response.json({
      configured: true,
      doubts: await response.json(),
    });
  } catch (error) {
    console.error(
      "Supabase teacher GET error:",
      error instanceof Error ? error.message : "Unknown error",
    );

    return Response.json(
      { error: "Teacher doubts are temporarily unavailable." },
      { status: 502 },
    );
  }
}

export async function PATCH(request: Request) {
  const config = supabaseConfig();

  if (!config) {
    return Response.json(
      { error: "Shared teacher storage is not configured." },
      { status: 503 },
    );
  }

  if (!hasTeacherAccess(request)) {
    return Response.json(
      { error: "Teacher access is required." },
      { status: 401 },
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request JSON." }, { status: 400 });
  }

  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body) ||
    typeof (body as { id?: unknown }).id !== "string" ||
    (body as { id: string }).id.length === 0 ||
    (body as { id: string }).id.length > 80
  ) {
    return Response.json({ error: "Invalid doubt id." }, { status: 400 });
  }

  try {
    const id = encodeURIComponent((body as { id: string }).id);

    const response = await fetch(
      config.url + "/rest/v1/student_doubts?id=eq." + id,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          apikey: config.key,
          Authorization: "Bearer " + config.key,
          Prefer: "return=minimal",
        },
        body: JSON.stringify({ status: "answered" }),
        signal: AbortSignal.timeout(5000),
        cache: "no-store",
      },
    );

    if (!response.ok) {
      console.error("Supabase teacher PATCH failed:", response.status);

      return Response.json(
        { error: "That doubt could not be updated." },
        { status: 502 },
      );
    }

    return Response.json({ ok: true });
  } catch (error) {
    console.error(
      "Supabase teacher PATCH error:",
      error instanceof Error ? error.message : "Unknown error",
    );

    return Response.json(
      { error: "That doubt could not be updated." },
      { status: 502 },
    );
  }
}
