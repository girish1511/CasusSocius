import type { TextSegment } from "./types";

export async function extractTxt(buffer: Buffer): Promise<TextSegment[]> {
  const text = buffer.toString("utf-8").trim();
  if (!text) return [];
  return [{ text, pageRef: null }];
}
