import { createServiceClient } from "../supabase/service";
import { embedTexts } from "../embeddings/openai";

export interface RetrievedChunk {
  id: string;
  document_id: string;
  content: string;
  page_ref: string | null;
  similarity: number;
}

const MATCH_COUNT_PER_CATEGORY = 8;

// Retrieval scoped to an explicit set of document ids (the checked docs from
// the chat filter chips). An empty id list for a category is a deliberate
// "search nothing here" signal, not an error — the caller skips the RPC call.
export async function searchChunks(
  documentIds: string[],
  query: string
): Promise<RetrievedChunk[]> {
  if (documentIds.length === 0) return [];

  const supabase = createServiceClient();
  const [queryEmbedding] = await embedTexts([query]);

  const { data, error } = await supabase.rpc("match_chunks", {
    query_embedding: queryEmbedding,
    match_document_ids: documentIds,
    match_count: MATCH_COUNT_PER_CATEGORY,
  });

  if (error) throw new Error(`Retrieval failed: ${error.message}`);
  return data ?? [];
}
