import { connection } from "next/server";
import { getDataProvider } from "@/data/providers";
import { haversineKm } from "@/lib/evidence";
import { factOf, type CaseFact } from "@/lib/assistant/facts";
import type { ChatAction } from "@/lib/assistant/types";

/**
 * The assistant.
 *
 * GET  /api/chat  -> { ai, facts }: whether a language model is configured, and
 *                    one compact record per case (the offline guide answers from these).
 * POST /api/chat  -> { text, actions }: an answer from a free language model
 *                    (Groq, OpenAI-compatible API), grounded in our data through tools.
 *                    Without GROQ_API_KEY, or when the free quota runs out, it
 *                    answers 501/503 and the app falls back to the offline guide.
 */

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-120b";
const MAX_TURNS = 8;
const MAX_CHARS = 1000;
const MAX_STEPS = 4;

/* ------------------------------- the data -------------------------------- */

let factsPromise: Promise<CaseFact[]> | null = null;
function loadFacts(): Promise<CaseFact[]> {
  factsPromise ??= (async () => {
    const provider = getDataProvider();
    const events = await provider.getEvents();
    const details = await Promise.all(events.map((e) => provider.getEventById(e.id)));
    return details.filter((d) => d !== null).map(factOf);
  })();
  return factsPromise;
}

/* ------------------------- a small per-visitor limit ------------------------- */

const hits = new Map<string, number[]>();
function allowed(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 3_600_000);
  const lastMinute = recent.filter((t) => now - t < 60_000).length;
  if (lastMinute >= 6 || recent.length >= 60) return false;
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();
  return true;
}

/* -------------------------------- prompting -------------------------------- */

function systemPrompt(facts: CaseFact[], audience: string, openCase: string | null): string {
  const index = facts
    .map((f) => `${f.id} | ${f.name} | ${f.type} | ${f.region}, ${f.country} | ${f.start} to ${f.end} | ${f.km2} km2 flagged`)
    .join("\n");
  return `You are the guide inside "Dancing with the SARs", an interactive globe made for the NASA Space Apps Challenge 2026. It turns real radar analyses from the NASA-ISRO NISAR satellite into stories: floods, wind damage, heat and drought, landslides, fires, earthquakes, glaciers and farming, from the Dominican Republic to the world.

How to answer:
- Reply in the language the user writes in (Spanish or English). Keep it short: 2 to 5 sentences unless they ask for more. Plain text; a short dash list is fine; no headings, tables or bold.
- Audience: ${audience === "technical" ? "technical reader: you may use dB, polarisations (HH/HV), InSAR, line of sight" : "everyone: everyday words, explain any technical term"}.
- Every number about a case must come from the case list below or from a tool result. Call get_case before quoting people, rain, wind, heat, earthquakes or alerts. If we do not have a figure, say so; never guess.
- A flagged change is a lead, not a verdict: nothing has been checked on the ground. Say so when you give results.
- People counts are estimates from the GHSL population grid (1 km squares), not a census. Weather is ERA5 via Open-Meteo at the centre of each area (about 25 km grid). Earthquakes come from the USGS catalogue.
- For safety questions give practical advice. In the Dominican Republic the emergency number is 9-1-1 and official alerts come from the COE and Defensa Civil; elsewhere, the local emergency number.
- Actions: when the user wants to go to, see or show a place, call fly_to_case. To hear a case told step by step, call open_story. To see through the clouds, call show_cloud_lens. For "my area / my community" without a named case, call cases_near if you know the place's coordinates, otherwise open_community.
- Off-topic requests: answer briefly if harmless, then bring it back to the map.

Science you can rely on: NISAR is a NASA-ISRO radar satellite (L-band, wave about 24 cm long, plus S-band) that images almost all land and ice every 12 days, day or night, through clouds. Calm water is a mirror: the pulse bounces away, so it looks dark. Leaves and stems scatter the pulse and send some back, so vegetation is bright; when fire, harvest or wind removes them, the echo drops. Decibels: 3 dB less is half the echo. Interferometry: one colour cycle (fringe) is about 12 cm of motion toward or away from the satellite (line of sight). Ice speed is measured by tracking the same cracks 12 days apart.
${openCase ? `\nThe user currently has this case open: ${openCase}. "This case", "here" or "this place" means it.\n` : ""}
Cases (id | name | type | place | dates | area flagged):
${index}`;
}

const TOOLS = [
  {
    type: "function",
    function: {
      name: "get_case",
      description: "Every figure we have for one case: dates, area flagged, people living in the area and on the changed land, rain/heat/wind around the key date, nearby earthquakes, field alert, ice speed or ground motion.",
      parameters: { type: "object", properties: { id: { type: "string", description: "Case id from the list" } }, required: ["id"] },
    },
  },
  {
    type: "function",
    function: {
      name: "cases_near",
      description: "Cases within a radius of a point, closest first, with their distance.",
      parameters: {
        type: "object",
        properties: { lat: { type: "number" }, lon: { type: "number" }, km: { type: "number", description: "Radius in km, default 40" } },
        required: ["lat", "lon"],
      },
    },
  },
  {
    type: "function",
    function: { name: "fly_to_case", description: "Fly the globe to a case and open its panel.", parameters: { type: "object", properties: { id: { type: "string" } }, required: ["id"] } },
  },
  {
    type: "function",
    function: { name: "open_story", description: "Start the step-by-step story of a case on the globe.", parameters: { type: "object", properties: { id: { type: "string" } }, required: ["id"] } },
  },
  {
    type: "function",
    function: { name: "show_cloud_lens", description: "Turn on the cloud lens: the day as a camera saw it, the ground under the clouds inside a circle.", parameters: { type: "object", properties: {} } },
  },
  {
    type: "function",
    function: { name: "open_community", description: "Open the 'Is my community at risk?' panel, where the user picks their place.", parameters: { type: "object", properties: {} } },
  },
];

interface GroqToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}
interface GroqMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: GroqToolCall[];
  tool_call_id?: string;
}

function runTool(call: GroqToolCall, facts: CaseFact[], actions: ChatAction[]): string {
  let args: Record<string, unknown> = {};
  try {
    args = JSON.parse(call.function.arguments || "{}") as Record<string, unknown>;
  } catch {
    return JSON.stringify({ error: "arguments were not valid JSON" });
  }
  const byId = (id: unknown) => facts.find((f) => f.id === id);
  switch (call.function.name) {
    case "get_case": {
      const f = byId(args.id);
      return JSON.stringify(f ?? { error: "no case with that id" });
    }
    case "cases_near": {
      const lat = Number(args.lat);
      const lon = Number(args.lon);
      const km = Number(args.km) || 40;
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return JSON.stringify({ error: "lat and lon are required" });
      const near = facts
        .map((f) => ({ id: f.id, name: f.name, type: f.type, km: Math.round(haversineKm(lat, lon, f.lat, f.lon)) }))
        .sort((a, b) => a.km - b.km);
      const within = near.filter((n) => n.km <= km);
      return JSON.stringify(within.length ? within.slice(0, 6) : { none_within_km: km, closest: near[0] });
    }
    case "fly_to_case":
    case "open_story": {
      const f = byId(args.id);
      if (!f) return JSON.stringify({ error: "no case with that id" });
      actions.push({ kind: call.function.name === "fly_to_case" ? "fly" : "story", id: f.id, label: f.name });
      return JSON.stringify({ ok: true, note: "The app will do this when your answer is shown." });
    }
    case "show_cloud_lens":
      actions.push({ kind: "lens" });
      return JSON.stringify({ ok: true });
    case "open_community":
      actions.push({ kind: "community" });
      return JSON.stringify({ ok: true });
    default:
      return JSON.stringify({ error: "unknown tool" });
  }
}

/** Plain text for the chat bubble: drop markdown emphasis and headings. */
const plain = (text: string) =>
  text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*\*\s+/gm, "- ")
    .trim();

/* --------------------------------- routes --------------------------------- */

export async function GET(): Promise<Response> {
  await connection();
  try {
    return Response.json({ ai: Boolean(process.env.GROQ_API_KEY), facts: await loadFacts() });
  } catch {
    return Response.json({ ai: false, facts: [] }, { status: 503 });
  }
}

interface ChatRequest {
  messages?: Array<{ role?: string; text?: string }>;
  audience?: string;
  openCase?: string | null;
}

export async function POST(request: Request): Promise<Response> {
  await connection();
  const key = process.env.GROQ_API_KEY;
  if (!key) return Response.json({ error: "no_model" }, { status: 501 });

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!allowed(ip)) return Response.json({ error: "busy" }, { status: 429 });

  let body: ChatRequest;
  try {
    body = (await request.json()) as ChatRequest;
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  const turns = (body.messages ?? [])
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.text === "string" && m.text.trim())
    .slice(-MAX_TURNS)
    .map((m): GroqMessage => ({ role: m.role as "user" | "assistant", content: (m.text as string).slice(0, MAX_CHARS) }));
  if (!turns.length || turns[turns.length - 1].role !== "user") return Response.json({ error: "bad_request" }, { status: 400 });

  const facts = await loadFacts();
  const openCase = typeof body.openCase === "string" && facts.some((f) => f.id === body.openCase) ? body.openCase : null;
  const messages: GroqMessage[] = [{ role: "system", content: systemPrompt(facts, body.audience === "technical" ? "technical" : "general", openCase) }, ...turns];
  const actions: ChatAction[] = [];

  try {
    for (let step = 0; step < MAX_STEPS; step++) {
      const res = await fetch(GROQ_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model: MODEL,
          messages,
          tools: TOOLS,
          tool_choice: step === MAX_STEPS - 1 ? "none" : "auto",
          temperature: 0.3,
          max_tokens: 1500,
        }),
        signal: AbortSignal.timeout(25_000),
      });
      if (res.status === 429) return Response.json({ error: "busy" }, { status: 503 });
      if (!res.ok) return Response.json({ error: "model_error", status: res.status }, { status: 502 });

      const data = (await res.json()) as { choices?: Array<{ message?: GroqMessage }> };
      const message = data.choices?.[0]?.message;
      if (!message) return Response.json({ error: "model_error" }, { status: 502 });

      if (message.tool_calls?.length) {
        messages.push({ role: "assistant", content: message.content ?? null, tool_calls: message.tool_calls });
        for (const call of message.tool_calls) {
          messages.push({ role: "tool", tool_call_id: call.id, content: runTool(call, facts, actions) });
        }
        continue;
      }
      const text = plain(message.content ?? "");
      if (!text) return Response.json({ error: "model_error" }, { status: 502 });
      return Response.json({ text, actions });
    }
    return Response.json({ error: "model_error" }, { status: 502 });
  } catch {
    return Response.json({ error: "model_error" }, { status: 502 });
  }
}
