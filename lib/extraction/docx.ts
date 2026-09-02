import mammoth from "mammoth";
import JSZip from "jszip";
import type { ExtractedImage, ExtractionResult } from "./types";

// Skip images below this byte size — a simple, cheap stand-in for "probably
// a logo/icon/bullet graphic" without needing to decode pixel dimensions.
const IMAGE_SIZE_THRESHOLD_BYTES = 5 * 1024;

const MIME_BY_EXTENSION: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  bmp: "image/bmp",
  webp: "image/webp",
};

// DOCX has no fixed pagination without a rendering engine, so this yields a
// single segment for the whole document (page_ref stays null for its
// chunks); extracted images are tagged the same way.
export async function extractDocx(buffer: Buffer): Promise<ExtractionResult> {
  const [mammothResult, images] = await Promise.all([
    mammoth.extractRawText({ buffer }),
    extractMediaImages(buffer),
  ]);

  const text = mammothResult.value.trim();
  const segments = text ? [{ text, pageRef: null }] : [];

  return { segments, images };
}

async function extractMediaImages(buffer: Buffer): Promise<ExtractedImage[]> {
  const zip = await JSZip.loadAsync(buffer);
  const mediaFiles = Object.keys(zip.files).filter((name) =>
    name.startsWith("word/media/")
  );

  const images: ExtractedImage[] = [];
  for (const filename of mediaFiles) {
    const ext = filename.toLowerCase().split(".").pop() ?? "";
    const mimeType = MIME_BY_EXTENSION[ext];
    if (!mimeType) continue; // skip non-raster media (e.g. embedded .emf/.wmf)

    const data = await zip.files[filename].async("uint8array");
    if (data.byteLength < IMAGE_SIZE_THRESHOLD_BYTES) continue;

    images.push({ data, mimeType, pageRef: null });
  }

  return images;
}
