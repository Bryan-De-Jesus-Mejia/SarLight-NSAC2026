import { buildEventDetail } from "../mock/details";
import { FEATURED_EVENTS } from "../mock/featured";
import { MOCK_TIME_RANGE, generateSecondaryEvents } from "../mock/generate";
import type {
  DataProvider,
  EventDetail,
  EventFilters,
  EventSummary,
  TimeRange,
} from "../types";

/**
 * Simulated dataset: 8 featured cases + 320 deterministic secondary signals.
 * Everything it returns carries source: "mock" and is labelled
 * "Simulated data" in the interface.
 */
export class MockProvider implements DataProvider {
  readonly source = "mock" as const;

  private cache: EventSummary[] | null = null;
  private details = new Map<string, EventDetail>();

  private all(): EventSummary[] {
    if (!this.cache) {
      this.cache = [...FEATURED_EVENTS, ...generateSecondaryEvents()];
    }
    return this.cache;
  }

  async getEvents(filters?: EventFilters): Promise<EventSummary[]> {
    let events = this.all();
    const types = filters?.types;
    if (types && types.length > 0) {
      events = events.filter((event) => types.includes(event.type));
    }
    if (filters?.featuredOnly) {
      events = events.filter((event) => event.featured);
    }
    return events;
  }

  async getEventById(id: string): Promise<EventDetail | null> {
    const cached = this.details.get(id);
    if (cached) return cached;

    const summary = this.all().find((event) => event.id === id);
    if (!summary) return null;

    const detail = buildEventDetail(summary);
    this.details.set(id, detail);
    return detail;
  }

  async getTimeRange(): Promise<TimeRange> {
    return { ...MOCK_TIME_RANGE };
  }
}
