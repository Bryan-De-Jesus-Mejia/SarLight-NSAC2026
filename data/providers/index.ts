import type { DataProvider } from "../types";
import { MockProvider } from "./mockProvider";
import { NisarProvider } from "./nisarProvider";

let instance: DataProvider | null = null;

/**
 * Server-side only. Picks the provider from the DATA_SOURCE env variable:
 * "nisar" → NisarProvider, anything else → MockProvider.
 */
export function getDataProvider(): DataProvider {
  if (!instance) {
    instance = process.env.DATA_SOURCE === "nisar" ? new NisarProvider() : new MockProvider();
  }
  return instance;
}
