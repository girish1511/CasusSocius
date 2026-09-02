import { extractText as extractPdfText, getDocumentProxy } from "unpdf";
import { extractPdfImages } from "./pdf-images";
import type { ExtractionResult } from "./types";

// Text extraction uses unpdf, not pdf-parse. Root-caused: pdf-parse bundles
// pdfjs-dist internally (its dist ships pdf.worker.mjs and the literal
// "fake worker failed" string — confirmed by inspecting its own dist
// output) and needs that worker file resolvable at a path relative to
// itself at runtime. That resolution breaks once Next.js bundles the
// server route, which is what caused the recurring "Setting up fake worker
// failed: Cannot find module 'pdf.worker.mjs'" error — on TEXT extraction,
// not the image-extraction path a prior fix touched (that path already
// used pdf-lib, a fully separate library with no pdfjs/pdf-parse
// dependency, so it was never the cause and needed no further change).
//
// unpdf ships a build of PDF.js specifically compiled for serverless/
// server environments — no worker thread, no browser APIs, runs
// synchronously in one call. It has zero npm dependencies of its own
// (vendors PDF.js directly), so this doesn't introduce a native-dependency
// risk for Railway either.
export async function extractPdf(buffer: Buffer): Promise<ExtractionResult> {
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { text: pagesText } = await extractPdfText(pdf, { mergePages: false });

  const segments = pagesText
    .map((text, i) => ({ text: text.trim(), pageRef: `page ${i + 1}` }))
    .filter((segment) => segment.text.length > 0);

  let images: ExtractionResult["images"] = [];
  try {
    images = await extractPdfImages(buffer);
  } catch (err) {
    console.error("[extraction/pdf] image extraction failed, continuing with text only:", err);
  }

  return { segments, images };
}
