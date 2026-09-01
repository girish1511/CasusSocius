import { extractPdf } from "./pdf";
import { extractDocx } from "./docx";
import { extractPptx } from "./pptx";
import { extractTxt } from "./txt";
import type { SupportedDocumentType, TextSegment } from "./types";

export type { TextSegment, SupportedDocumentType } from "./types";
export { SUPPORTED_MIME_TYPES, documentTypeFromFilename } from "./types";

// Each file type needs its own parsing approach (PDF page rendering, DOCX
// zipped-XML-via-mammoth, PPTX slide XML, plain text) — deliberately not
// routed through one generic parser.
export async function extractText(
  type: SupportedDocumentType,
  buffer: Buffer
): Promise<TextSegment[]> {
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
