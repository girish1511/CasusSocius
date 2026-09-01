import Anthropic from "@anthropic-ai/sdk";
import { createServiceClient } from "../supabase/service";
import { searchChunks, type RetrievedChunk } from "../retrieval/search";

const CHAT_MODEL = "claude-sonnet-4-5";

export interface Citation {
  documentId: string;
  documentTitle: string;
  pageRef: string | null;
}

export interface AnswerResult {
  answer: string;
  citations: Citation[];
  sessionId: string;
}

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

// Grounded Q&A per CLAUDE.md rule #1: retrieves chunks from the caller's
// selected lecture/quiz-sample documents and answers only from that context,
// citing which document each cited passage came from. Chat history persists
// to chat_sessions/chat_messages.
export async function answerQuestion(params: {
  courseId: string;
  question: string;
  lectureDocumentIds: string[];
  quizDocumentIds: string[];
  sessionId: string | null;
}): Promise<AnswerResult> {
  const { courseId, question, lectureDocumentIds, quizDocumentIds } = params;
  const supabase = createServiceClient();

  const allSelectedIds = [...lectureDocumentIds, ...quizDocumentIds];
  if (allSelectedIds.length === 0) {
    throw new Error(
      "Select at least one source document before asking a question."
    );
  }

  const [lectureChunks, quizChunks] = await Promise.all([
    searchChunks(lectureDocumentIds, question),
    searchChunks(quizDocumentIds, question),
  ]);
  const chunks = [...lectureChunks, ...quizChunks];

  let sessionId = params.sessionId;
  if (!sessionId) {
    const { data: session, error } = await supabase
      .from("chat_sessions")
      .insert({ course_id: courseId })
      .select("id")
      .single();
    if (error || !session) {
      throw new Error(`Failed to create chat session: ${error?.message}`);
    }
    sessionId = session.id;
  }

  const { data: docsData } = await supabase
    .from("documents")
    .select("id, title")
    .in("id", allSelectedIds);
  const titleById = new Map((docsData ?? []).map((d) => [d.id, d.title]));

  const context = buildContext(chunks, titleById);
  const answer = await callClaude(question, context);

  const citedChunkIds = chunks.map((c) => c.id);

  await supabase.from("chat_messages").insert([
    { session_id: sessionId, role: "user", content: question, cited_chunk_ids: [] },
    {
      session_id: sessionId,
      role: "assistant",
      content: answer,
      cited_chunk_ids: citedChunkIds,
    },
  ]);

  const citations: Citation[] = dedupeCitations(
    chunks.map((c) => ({
      documentId: c.document_id,
      documentTitle: titleById.get(c.document_id) ?? "Untitled document",
      pageRef: c.page_ref,
    }))
  );

  return { answer, citations, sessionId: sessionId! };
}

function buildContext(
  chunks: RetrievedChunk[],
  titleById: Map<string, string>
): string {
  if (chunks.length === 0) return "";
  return chunks
    .map((chunk, i) => {
      const title = titleById.get(chunk.document_id) ?? "Untitled document";
      const loc = chunk.page_ref ? `, ${chunk.page_ref}` : "";
      return `[${i + 1}] (${title}${loc})\n${chunk.content}`;
    })
    .join("\n\n");
}

async function callClaude(question: string, context: string): Promise<string> {
  const anthropic = getClient();

  const system = `You are a study assistant answering questions about a student's uploaded course material. Answer ONLY using the provided context excerpts below — never from general knowledge. If the context doesn't contain the answer, say so plainly instead of guessing. Cite which document each part of your answer comes from using the bracketed numbers, e.g. [1].

Context:
${context || "(no matching context found)"}`;

  const response = await anthropic.messages.create({
    model: CHAT_MODEL,
    max_tokens: 1024,
    system,
    messages: [{ role: "user", content: question }],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  return textBlock?.type === "text" ? textBlock.text : "";
}

function dedupeCitations(citations: Citation[]): Citation[] {
  const seen = new Set<string>();
  const result: Citation[] = [];
  for (const c of citations) {
    const key = `${c.documentId}:${c.pageRef ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(c);
  }
  return result;
}
