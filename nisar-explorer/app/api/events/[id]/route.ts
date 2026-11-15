import { connection } from "next/server";
import { getDataProvider } from "@/data/providers";
import type { ApiErrorResponse } from "@/data/types";

const errorResponse = (status: number, code: string, message: string): Response => {
  const body: ApiErrorResponse = { error: { code, message } };
  return Response.json(body, { status });
};

/** GET /api/events/[id] — the full detail of one event, for the case panel. */
export async function GET(_request: Request, ctx: RouteContext<"/api/events/[id]">): Promise<Response> {
  await connection();
  const { id } = await ctx.params;

  try {
    const detail = await getDataProvider().getEventById(id);
    if (!detail) {
      return errorResponse(404, "EVENT_NOT_FOUND", "No change signal exists with that id.");
    }
    return Response.json(detail);
  } catch (error) {
    return errorResponse(
      503,
      "DATA_SOURCE_UNAVAILABLE",
      error instanceof Error ? error.message : "The data source is unavailable.",
    );
  }
}
