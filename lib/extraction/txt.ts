import type { ExtractionResult } from "./types";

export async function extractTxt(buffer: Buffer): Promise<ExtractionResult> {
  const text = buffer.toString("utf-8").trim();
  return { segments: text ? [{ text, pageRef: null }] : [], images: [] };
}
