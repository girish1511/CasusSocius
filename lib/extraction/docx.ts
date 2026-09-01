import mammoth from "mammoth";
import type { TextSegment } from "./types";

// DOCX has no fixed pagination without a rendering engine, so this yields a
// single segment for the whole document (page_ref stays null for its chunks).
export async function extractDocx(buffer: Buffer): Promise<TextSegment[]> {
  const result = await mammoth.extractRawText({ buffer });
  const text = result.value.trim();
  if (!text) return [];
  return [{ text, pageRef: null }];
}
