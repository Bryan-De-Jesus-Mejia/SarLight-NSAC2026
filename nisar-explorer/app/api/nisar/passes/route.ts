import { connection } from "next/server";
import {
  fetchCatalogueScenes,
  fetchOrbitElements,
  markImaged,
  orbitPasses,
  type CatalogueScene,
  type PassesResponse,
} from "@/lib/nisarPasses";

/** How far ahead to look: a bit more than one 12-day cycle, so both the dawn and the dusk pass appear. */
const DAYS_AHEAD = 14;
const MAX_PASSES = 8;

const failure = (status: number, code: string, message: string): Response =>
  Response.json({ error: { code, message } }, { status });

/**
 * GET /api/nisar/passes?lat=18.5&lon=-70.2
 * The next moments NISAR can image a place, and the real scenes it has already imaged there.
 * Nothing about the visitor is stored; the coordinates are rounded to 0.01° (about a kilometre).
 */
export async function GET(request: Request): Promise<Response> {
  await connection();

  const params = new URL(request.url).searchParams;
  const lat = Number(params.get("lat"));
  const lon = Number(params.get("lon"));
  if (!params.has("lat") || !params.has("lon") || !Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return failure(400, "BAD_POINT", "Give a latitude between −90 and 90 and a longitude between −180 and 180.");
  }
  const point = { lat: Math.round(lat * 100) / 100, lon: Math.round(lon * 100) / 100 };

  try {
    const [elements, scenesResult] = await Promise.all([
      fetchOrbitElements(),
      fetchCatalogueScenes(point.lat, point.lon).then(
        (scenes) => ({ scenes, available: true }),
        () => ({ scenes: [] as CatalogueScene[], available: false }),
      ),
    ]);

    const now = Date.now();
    const passes = markImaged(orbitPasses(elements, point, now, DAYS_AHEAD), scenesResult.scenes).slice(0, MAX_PASSES);
    const body: PassesResponse = {
      generatedAt: new Date(now).toISOString(),
      point,
      orbit: {
        source: elements.source,
        epoch: elements.epoch,
        ageDays: Math.round(((now - new Date(elements.epoch).getTime()) / 86_400_000) * 10) / 10,
      },
      scenes: scenesResult.scenes.slice(0, 6),
      scenesAvailable: scenesResult.available,
      passes,
    };
    return Response.json(body, { headers: { "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600" } });
  } catch {
    return failure(502, "ORBIT_UNAVAILABLE", "The orbital data is not available right now. Try again in a few minutes.");
  }
}
