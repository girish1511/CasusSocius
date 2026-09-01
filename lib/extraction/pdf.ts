import { PDFParse } from "pdf-parse";
import type { TextSegment } from "./types";

// One segment per PDF page, so chunks can carry a page number in page_ref.
export async function extractPdf(buffer: Buffer): Promise<TextSegment[]> {
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return result.pages
      .filter((page) => page.text.trim().length > 0)
      .map((page) => ({
        text: page.text,
        pageRef: `page ${page.num}`,
      }));
  } finally {
    await parser.destroy();
  }
}
