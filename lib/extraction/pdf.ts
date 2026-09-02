import { PDFParse } from "pdf-parse";
import { extractPdfImages } from "./pdf-images";
import type { ExtractionResult } from "./types";

// Text extraction stays on pdf-parse, unchanged. Embedded-image extraction
// goes through pdf-lib instead (see ./pdf-images.ts) — pdf-parse's own
// getImage() was tried first, but it renders each image via pdfjs-dist
// internally, and pdfjs-dist's worker setup fails in the bundled Next.js
// server environment ("Setting up fake worker failed: Cannot find module
// 'pdf.worker.mjs'"), breaking image extraction (though not text
// extraction, which doesn't need the worker). pdf-lib parses the PDF
// object structure directly and synchronously, with no worker/browser
// dependency, so it doesn't hit this failure mode.
export async function extractPdf(buffer: Buffer): Promise<ExtractionResult> {
  const parser = new PDFParse({ data: buffer });
  let segments: ExtractionResult["segments"];
  try {
    const textResult = await parser.getText();
    segments = textResult.pages
      .filter((page) => page.text.trim().length > 0)
      .map((page) => ({
        text: page.text,
        pageRef: `page ${page.num}`,
      }));
  } finally {
    await parser.destroy();
  }

  let images: ExtractionResult["images"] = [];
  try {
    images = await extractPdfImages(buffer);
  } catch (err) {
    console.error("[extraction/pdf] image extraction failed, continuing with text only:", err);
  }

  return { segments, images };
}
