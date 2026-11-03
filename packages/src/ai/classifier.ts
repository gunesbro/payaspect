import type { Classification } from "../domain/types.ts";

/** Options for a single classification request. */
export interface ClassificationInput {
  merchant?: string | null;
  note?: string | null;
  ocrText?: string | null;
}

/**
 * A category classifier. Implementations may be:
 * - an on-device embedding + head model (ONNX), or
 * - a lightweight rule/keyword fallback.
 * The interface is intentionally model-agnostic so the UI never depends on
 * a specific runtime and models can be swapped offline.
 */
export interface Classifier {
  classify(input: ClassificationInput): Promise<Classification>;
  /** Release any native/allocated resources. */
  dispose(): Promise<void>;
}
