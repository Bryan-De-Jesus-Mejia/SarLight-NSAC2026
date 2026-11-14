/**
 * Web worker that paints the synthetic radar images (see syntheticSar.ts).
 * Each image takes a few hundred milliseconds of pixel maths: done here, it
 * never blocks the globe.
 */
import { SAR_IMAGE_HEIGHT, SAR_IMAGE_WIDTH, drawSarScene, type SarSceneOptions } from "./syntheticSar";

export interface SarJob {
  id: number;
  options: SarSceneOptions;
  moment: "before" | "after";
}

export interface SarResult {
  id: number;
  bitmap: ImageBitmap | null;
}

const scope = self as unknown as {
  onmessage: ((event: MessageEvent<SarJob>) => void) | null;
  postMessage: (message: SarResult, transfer?: Transferable[]) => void;
};

scope.onmessage = (event) => {
  const { id, options, moment } = event.data;
  const canvas = new OffscreenCanvas(SAR_IMAGE_WIDTH, SAR_IMAGE_HEIGHT);
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    scope.postMessage({ id, bitmap: null });
    return;
  }
  drawSarScene(ctx, options, moment);
  const bitmap = canvas.transferToImageBitmap();
  scope.postMessage({ id, bitmap }, [bitmap]);
};
