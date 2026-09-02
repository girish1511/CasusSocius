import Anthropic from "@anthropic-ai/sdk";
import { createServiceClient } from "../supabase/service";

const SUMMARY_MODEL = "claude-sonnet-4-5";

// Rough character budget for the source text fed to the model — enough for
// a thorough summary without risking an oversized request. ~4 chars/token,
// so this stays well inside the model's context window alongside the
// prompt and response.
const MAX_SOURCE_CHARS = 24000;

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

export interface SummaryResult {
  summary: string;
  truncated: boolean;
}

// Summaries are cached on the `documents` row (summary, summary_truncated,
// summary_generated_at) so reopening the same document reuses the stored
// result instead of re-calling Claude every time. Pass force: true to
// bypass the cache and regenerate.
export async function summarizeDocument(
  documentId: string,
  options: { force?: boolean } = {}
): Promise<SummaryResult> {
  const supabase = createServiceClient();

  if (!options.force) {
    const { data: existing } = await supabase
      .from("documents")
      .select("summary, summary_truncated")
      .eq("id", documentId)
      .single();

    if (existing?.summary) {
      return { summary: existing.summary, truncated: existing.summary_truncated };
    }
  }

  // Ordered by page_ref as specified. Note: page_ref is free-form text
  // ("page 1", "page 10", "slide 2"), so this is a lexical sort, not a
  // numeric one — "page 10" sorts before "page 2". Good enough for a
  // summary (order affects flow, not correctness), but flagging since a
  // true numeric order would need a dedicated sequence column, which is
  // out of scope here.
  const { data: chunks, error } = await supabase
    .from("chunks")
    .select("content, page_ref")
    .eq("document_id", documentId)
    .order("page_ref", { ascending: true });

  if (error) throw new Error(`Failed to load document chunks: ${error.message}`);
  if (!chunks || chunks.length === 0) {
    throw new Error("This document has no extracted content to summarize.");
  }

  let sourceText = "";
  let truncated = false;
  for (const chunk of chunks) {
    if (sourceText.length + chunk.content.length > MAX_SOURCE_CHARS) {
      truncated = true;
      break;
    }
    sourceText += (sourceText ? "\n\n" : "") + chunk.content;
  }

  const summary = await draftSummary(sourceText, truncated);

  const { error: updateError } = await supabase
    .from("documents")
    .update({
      summary,
      summary_truncated: truncated,
      summary_generated_at: new Date().toISOString(),
    })
    .eq("id", documentId);
  if (updateError) {
    // Don't fail the request over a caching write — the user still gets
    // their summary, it just won't be cached for next time.
    console.error(`[documents/summarize] failed to cache summary for ${documentId}:`, updateError);
  }

  return { summary, truncated };
}

async function draftSummary(sourceText: string, truncated: boolean): Promise<string> {
  const anthropic = getClient();

  const system = `You are summarizing a piece of MBA course material for a student's quick review. Write a concise, well-structured summary covering the key concepts, arguments, and takeaways — do not simply reproduce or paraphrase the text at length. Use markdown: a short intro, then headers or bullet points to organize the main ideas.${
    truncated
      ? " Note: the provided source is only the first portion of a longer document, so base the summary on that portion and don't claim to cover the whole document."
      : ""
  }`;

  const response = await anthropic.messages.create({
    model: SUMMARY_MODEL,
    max_tokens: 1024,
    system,
    messages: [{ role: "user", content: sourceText }],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  return textBlock?.type === "text" ? textBlock.text : "";
}
