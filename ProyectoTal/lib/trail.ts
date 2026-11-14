import type { EventSummary } from "@/data/types";
import { pointInRegion, viewForBBox, type RegionFeature, type View } from "@/lib/geo";
import type { TrailItem } from "@/store/useAppStore";

/** Breadcrumb steps and the camera views that reach them. */

export const WORLD_VIEW: View = { lat: 16, lng: -62, altitude: 2.35 };
export const CARIBBEAN_VIEW: View = { lat: 19, lng: -72, altitude: 0.55 };

/** Rough Caribbean box: [minLng, minLat, maxLng, maxLat]. */
const CARIBBEAN_BOX = [-87, 8, -58, 28] as const;

export const DR_ISO = "DOM";

const inCaribbean = (lat: number, lng: number): boolean =>
  lng >= CARIBBEAN_BOX[0] && lat >= CARIBBEAN_BOX[1] && lng <= CARIBBEAN_BOX[2] && lat <= CARIBBEAN_BOX[3];

export const worldItem: TrailItem = { key: "world", label: "World", kind: "world", view: WORLD_VIEW };
const caribbeanItem: TrailItem = {
  key: "caribbean",
  label: "Caribbean",
  kind: "region",
  view: CARIBBEAN_VIEW,
};

export function countryItem(country: RegionFeature, aspect: number): TrailItem {
  return {
    key: `country:${country.id}`,
    label: country.name,
    kind: "country",
    view: viewForBBox(country.mainBBox, aspect, 1.5),
  };
}

export function provinceItem(province: RegionFeature, aspect: number): TrailItem {
  return {
    key: `province:${province.id}`,
    label: province.name,
    kind: "province",
    view: viewForBBox(province.mainBBox, aspect, 1.9),
    provinceId: province.id,
  };
}

export function eventItem(event: EventSummary, view: View): TrailItem {
  return { key: `event:${event.id}`, label: event.name, kind: "event", view, eventId: event.id };
}

/** Trail for a country the camera was taken to. */
export function trailForCountry(country: RegionFeature, aspect: number): TrailItem[] {
  const centre = viewForBBox(country.mainBBox, aspect);
  const items: TrailItem[] = [worldItem];
  if (inCaribbean(centre.lat, centre.lng)) items.push(caribbeanItem);
  items.push(countryItem(country, aspect));
  return items;
}

export function trailForProvince(
  province: RegionFeature,
  country: RegionFeature | undefined,
  aspect: number,
): TrailItem[] {
  const base = country ? trailForCountry(country, aspect) : [worldItem, caribbeanItem];
  return [...base, provinceItem(province, aspect)];
}

/** Trail for an event: through its province when it lies in the Dominican Republic. */
export function trailForEvent(
  event: EventSummary,
  eventView: View,
  provinces: RegionFeature[],
  countries: RegionFeature[],
  aspect: number,
): TrailItem[] {
  const province = provinces.find((p) => pointInRegion(event.lon, event.lat, p));
  if (province) {
    const dr = countries.find((c) => c.id === DR_ISO);
    return [...trailForProvince(province, dr, aspect), eventItem(event, eventView)];
  }

  const items: TrailItem[] = [worldItem];
  if (inCaribbean(event.lat, event.lon)) items.push(caribbeanItem);
  const host = countries.find((c) => pointInRegion(event.lon, event.lat, c));
  if (host) items.push(countryItem(host, aspect));
  items.push(eventItem(event, eventView));
  return items;
}
