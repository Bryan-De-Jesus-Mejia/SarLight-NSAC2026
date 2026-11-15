import { createGroq } from "@ai-sdk/groq";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText, type LanguageModel, type ModelMessage } from "ai";
import { buildInstructions } from "@/lib/chatKnowledge";

/**
 * POST /api/chat — the assistant. Free tiers only: Groq first (fast), then the
 * free models on OpenRouter when Groq is out of quota or down. When every
 * provider fails the panel falls back to its built-in answers, so the chat is
 * never silent.
 *
 * Keys live in the server environment (Vercel → Settings → Environment Variables):
 *   GROQ_API_KEY, OPENROUTER_API_KEY
 * Optional: GROQ_MODEL, OPENROUTER_MODELS (comma-separated, tried in order).
 */

export const maxDuration = 60;

const MAX_TEXT = 1000;
const MAX_TURNS = 10;
/** Questions per visitor per hour, per server instance. Enough for real use, a brake on abuse. */
const PER_HOUR = 30;

interface Attempt {
  label: string;
  model: LanguageModel;
  providerOptions?: Parameters<typeof generateText>[0]["providerOptions"];
}

function attempts(): Attempt[] {
  const list: Attempt[] = [];
  if (process.env.GROQ_API_KEY) {
    const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });
    const id = process.env.GROQ_MODEL ?? "openai/gpt-oss-120b";
    // Low reasoning keeps the answer fast and inside the free tokens-per-minute cap.
    list.push({ label: `groq:${id}`, model: groq(id), providerOptions: { groq: { reasoningEffort: "low" } } });
  }
  if (process.env.OPENROUTER_API_KEY) {
    const openrouter = createOpenAICompatible({
      name: "openrouter",
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: process.env.OPENROUTER_API_KEY,
      headers: { "X-Title": "Dancing with the SARs" },
    });
    const ids = (process.env.OPENROUTER_MODELS ?? "google/gemma-4-31b-it:free,nvidia/nemotron-3.5-super-vl:free").split(",");
    for (const id of ids.map((s) => s.trim()).filter(Boolean)) list.push({ label: `openrouter:${id}`, model: openrouter.chatModel(id) });
  }
  return list;
}

const hits = new Map<string, number[]>();

function allowed(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((at) => now - at < 3_600_000);
  if (recent.length >= PER_HOUR) return false;
  recent.push(now);
  hits.set(ip, recent);
  return true;
}

interface Body {
  messages?: Array<{ role?: string; text?: string }>;
  caseId?: string | null;
  lang?: string;
}

const error = (status: number, code: string) => Response.json({ error: { code } }, { status });

export async function POST(request: Request): Promise<Response> {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!allowed(ip)) return error(429, "RATE_LIMITED");

  const body = (await request.json().catch(() => null)) as Body | null;
  const messages: ModelMessage[] = (body?.messages ?? [])
    .slice(-MAX_TURNS)
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.text === "string" && m.text.trim())
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.text!.slice(0, MAX_TEXT) }));
  const last = messages[messages.length - 1];
  if (!last || last.role !== "user") return error(400, "BAD_REQUEST");

  const list = attempts();
  if (!list.length) return error(503, "NOT_CONFIGURED");

  const caseId = typeof body?.caseId === "string" ? body.caseId : null;
  const lang = body?.lang === "es" ? "es" : "en";
  const instructions = await buildInstructions(last.content as string, caseId, lang);

  for (const attempt of list) {
    try {
      const result = await generateText({
        model: attempt.model,
        instructions,
        messages,
        maxOutputTokens: 900,
        maxRetries: 0,
        timeout: 25_000,
        providerOptions: attempt.providerOptions,
      });
      const answer = result.text.trim();
      if (answer) return Response.json({ answer, provider: attempt.label });
    } catch (e) {
      console.warn(`[chat] ${attempt.label} failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return error(503, "ALL_PROVIDERS_FAILED");
}
