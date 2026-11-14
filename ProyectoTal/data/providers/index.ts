import type { DataProvider } from "../types";
import { AnalysisProvider } from "./analysisProvider";

let instance: AnalysisProvider | null = null;

/**
 * Server-side only. The app reads the radar analyses produced by the data
 * pipeline. Live feeds (earthquakes, fires, storms…) would be added here by
 * composing more DataProvider implementations.
 */
export function getDataProvider(): DataProvider & { generatedAt(): string } {
  instance ??= new AnalysisProvider();
  return instance;
}
