import { createServiceClient } from "../supabase/service";
import { extractText, type SupportedDocumentType } from "../extraction";
import { chunkSegments } from "../chunking/chunk";
import { embedTexts } from "../embeddings/openai";

const CHUNK_INSERT_BATCH_SIZE = 100;

// Runs the full extract -> chunk -> embed -> store pipeline for one
// document and updates its status accordingly. Called fire-and-forget right
// after upload; failures are caught and recorded as status 'error' rather
// than propagating, so one bad file can't take down the upload request.
export async function processDocument(
  documentId: string,
  buffer: Buffer,
  type: SupportedDocumentType
): Promise<void> {
  const supabase = createServiceClient();

  try {
    const segments = await extractText(type, buffer);
    const chunks = chunkSegments(segments);

    if (chunks.length === 0) {
      throw new Error("No extractable text found in document");
    }

    const embeddings = await embedTexts(chunks.map((c) => c.content));

    for (let i = 0; i < chunks.length; i += CHUNK_INSERT_BATCH_SIZE) {
      const chunkBatch = chunks.slice(i, i + CHUNK_INSERT_BATCH_SIZE);
      const embeddingBatch = embeddings.slice(i, i + CHUNK_INSERT_BATCH_SIZE);

      const { error } = await supabase.from("chunks").insert(
        chunkBatch.map((chunk, idx) => ({
          document_id: documentId,
          content: chunk.content,
          embedding: embeddingBatch[idx],
          page_ref: chunk.pageRef,
        }))
      );
      if (error) throw new Error(`Failed to insert chunks: ${error.message}`);
    }

    const { error: statusError } = await supabase
      .from("documents")
      .update({ status: "ready" })
      .eq("id", documentId);
    if (statusError) {
      throw new Error(`Failed to update status: ${statusError.message}`);
    }
  } catch (err) {
    console.error(`[documents/pipeline] document ${documentId} failed:`, err);
    await supabase
      .from("documents")
      .update({ status: "error" })
      .eq("id", documentId);
  }
}
