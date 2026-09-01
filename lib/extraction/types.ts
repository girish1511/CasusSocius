// A contiguous piece of extracted text with an optional human-readable
// locator (page number, slide number, etc.) used to populate chunks.page_ref.
export interface TextSegment {
  text: string;
  pageRef: string | null;
}

export type SupportedDocumentType = "pdf" | "docx" | "pptx" | "txt";

export const SUPPORTED_MIME_TYPES: Record<string, SupportedDocumentType> = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "docx",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation":
    "pptx",
  "text/plain": "txt",
};

export function documentTypeFromFilename(
  filename: string
): SupportedDocumentType | null {
  const ext = filename.toLowerCase().split(".").pop();
  switch (ext) {
    case "pdf":
      return "pdf";
    case "docx":
      return "docx";
    case "pptx":
      return "pptx";
    case "txt":
      return "txt";
    default:
      return null;
  }
}
