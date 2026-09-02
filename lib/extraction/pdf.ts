import { PDFParse } from "pdf-parse";
import type { ExtractedImage, ExtractionResult } from "./types";

// pdf-parse pulls the actual embedded image XObjects out of each page
// (via pdfjs-dist) rather than rasterizing full pages — lighter and more
// precise than page rendering, and it's the same dependency already used
// for text extraction, so this adds no new library. Its own imageThreshold
// (pixel width/height) does the "skip tiny decorative images" filtering for
// us — default 80px, used here explicitly for clarity.
//
// Note on native deps: pdf-parse's getImage() encodes extracted images via
// @napi-rs/canvas internally (a transitive dependency of pdf-parse itself).
// That's the same prebuilt-binary, no-Cairo/Pango library already accepted
// for chart rendering in an earlier task — this doesn't introduce a second,
// different native dependency, it reuses the one already flagged as safe.
const IMAGE_SIZE_THRESHOLD_PX = 80;

function mimeTypeFromDataUrl(dataUrl: string): string {
  const match = dataUrl.match(/^data:(.*?);/);
  return match?.[1] ?? "image/png";
}

export async function extractPdf(buffer: Buffer): Promise<ExtractionResult> {
  const parser = new PDFParse({ data: buffer });
  try {
    const [textResult, imageResult] = await Promise.all([
      parser.getText(),
      parser.getImage({ imageThreshold: IMAGE_SIZE_THRESHOLD_PX }),
    ]);

    const segments = textResult.pages
      .filter((page) => page.text.trim().length > 0)
      .map((page) => ({
        text: page.text,
        pageRef: `page ${page.num}`,
      }));

    const images: ExtractedImage[] = imageResult.pages.flatMap((page) =>
      page.images.map((image) => ({
        data: image.data,
        mimeType: mimeTypeFromDataUrl(image.dataUrl),
        pageRef: `page ${page.pageNumber}`,
      }))
    );

    return { segments, images };
  } finally {
    await parser.destroy();
  }
}
