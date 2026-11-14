import { connection } from "next/server";
import { getDataProvider } from "@/data/providers";
import type { ApiErrorResponse, EventsResponse } from "@/data/types";

/**
 * GET /api/events — the only door between the interface and the data layer.
 * Returns every signal once; filters and the timeline are applied client-side.
 */
export async function GET(): Promise<Response> {
  // Resolve at request time so DATA_SOURCE is read from the running server's
  // environment instead of being frozen into a build-time prerender.
  await connection();

  try {
    const provider = getDataProvider();
    const [events, timeRange] = await Promise.all([
      provider.getEvents(),
      provider.getTimeRange(),
    ]);

    const body: EventsResponse = {
      meta: { source: provider.source, count: events.length, timeRange },
      events,
    };
    return Response.json(body);
  } catch (error) {
    const body: ApiErrorResponse = {
      error: {
        code: "DATA_SOURCE_UNAVAILABLE",
        message: error instanceof Error ? error.message : "The data source is unavailable.",
      },
    };
    return Response.json(body, { status: 503 });
  }
}
