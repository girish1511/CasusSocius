import { extractPdf } from "./pdf";
import { extractDocx } from "./docx";
import { extractPptx } from "./pptx";
import { extractTxt } from "./txt";
import type { SupportedDocumentType, ExtractionResult } from "./types";

export type {
  TextSegment,
  ExtractedImage,
  ExtractionResult,
  SupportedDocumentType,
} from "./types";
export { SUPPORTED_MIME_TYPES, documentTypeFromFilename } from "./types";

// Each file type needs its own parsing approach (PDF page/image extraction,
// DOCX zipped-XML-via-mammoth plus word/media/, PPTX slide XML plus
// relationship-resolved ppt/media/, plain text) — deliberately not routed
// through one generic parser.
export async function extractText(
  type: SupportedDocumentType,
  buffer: Buffer
): Promise<ExtractionResult> {
  switch (type) {
    case "pdf":
      return extractPdf(buffer);
    case "docx":
      return extractDocx(buffer);
    case "pptx":
      return extractPptx(buffer);
    case "txt":
      return extractTxt(buffer);
  }
}
