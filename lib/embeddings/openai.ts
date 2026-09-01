import OpenAI from "openai";

// Must match the pgvector column dimension (chunks.embedding vector(1536)).
// Don't swap models/dimensions without a migration to match.
export const EMBEDDING_MODEL = "text-embedding-3-small";
export const EMBEDDING_DIMENSIONS = 1536;

const BATCH_SIZE = 100;

let client: OpenAI | null = null;
function getClient(): OpenAI {
  if (!client) {
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return client;
}

// Embeds texts in batches to stay within request-size limits and avoid
// holding one giant request for very large documents.
export async function embedTexts(texts: string[]): Promise<number[][]> {
  const openai = getClient();
  const embeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: batch,
    });
    for (const item of response.data) {
      embeddings.push(item.embedding);
    }
  }

  return embeddings;
}
