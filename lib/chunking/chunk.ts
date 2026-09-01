import type { TextSegment } from "../extraction/types";

export interface Chunk {
  content: string;
  pageRef: string | null;
}

// Rough token estimate (no tokenizer dependency): ~4 characters per token
// for English prose. Good enough for sizing chunks, not exact.
const CHARS_PER_TOKEN = 4;
const TARGET_TOKENS = 650; // mid-point of the 500-800 token target range
const OVERLAP_TOKENS = 100;

const TARGET_CHARS = TARGET_TOKENS * CHARS_PER_TOKEN;
const OVERLAP_CHARS = OVERLAP_TOKENS * CHARS_PER_TOKEN;

interface Word {
  text: string;
  pageRef: string | null;
}

// Splits segments into words up front, each tagged with the page/slide it
// came from, then slides a window over the word list. Working word-by-word
// (rather than re-scanning the full document string per chunk) keeps this
// linear in document length instead of quadratic, so it doesn't choke on a
// long PDF.
function toWords(segments: TextSegment[]): Word[] {
  const words: Word[] = [];
  for (const segment of segments) {
    for (const text of segment.text.split(/\s+/).filter(Boolean)) {
      words.push({ text, pageRef: segment.pageRef });
    }
  }
  return words;
}

export function chunkSegments(segments: TextSegment[]): Chunk[] {
  const words = toWords(segments);
  if (words.length === 0) return [];

  const chunks: Chunk[] = [];
  let start = 0;

  while (start < words.length) {
    let end = start;
    let charCount = 0;

    while (end < words.length && charCount < TARGET_CHARS) {
      charCount += words[end].text.length + 1;
      end += 1;
    }

    const chunkWords = words.slice(start, end);
    chunks.push({
      content: chunkWords.map((w) => w.text).join(" "),
      pageRef: chunkWords[0]?.pageRef ?? null,
    });

    if (end >= words.length) break;

    // Step the window forward, walking back from `end` by roughly
    // OVERLAP_CHARS so consecutive chunks share trailing/leading context.
    let overlapChars = 0;
    let next = end;
    while (next > start && overlapChars < OVERLAP_CHARS) {
      next -= 1;
      overlapChars += words[next].text.length + 1;
    }
    start = Math.max(next, start + 1); // always make forward progress
  }

  return chunks;
}
