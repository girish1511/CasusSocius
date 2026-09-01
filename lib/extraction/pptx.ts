import JSZip from "jszip";
import { XMLParser } from "fast-xml-parser";
import type { TextSegment } from "./types";

const parser = new XMLParser({
  ignoreAttributes: true,
  textNodeName: "#text",
});

// Recursively collects every <a:t> text-run value out of a parsed slide XML
// object, regardless of how deeply it's nested under shapes/paragraphs.
function collectTextRuns(node: unknown, out: string[]): void {
  if (node == null) return;
  if (Array.isArray(node)) {
    for (const item of node) collectTextRuns(item, out);
    return;
  }
  if (typeof node !== "object") return;

  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    if (key === "a:t") {
      if (typeof value === "string") out.push(value);
      else if (value && typeof value === "object" && "#text" in value) {
        out.push(String((value as { "#text": unknown })["#text"]));
      }
    } else {
      collectTextRuns(value, out);
    }
  }
}

// PPTX is a zip of per-slide XML files (ppt/slides/slideN.xml). One segment
// per slide, so chunks can carry a slide number in page_ref.
export async function extractPptx(buffer: Buffer): Promise<TextSegment[]> {
  const zip = await JSZip.loadAsync(buffer);

  const slideFiles = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => {
      const numA = Number(a.match(/slide(\d+)\.xml$/)?.[1] ?? 0);
      const numB = Number(b.match(/slide(\d+)\.xml$/)?.[1] ?? 0);
      return numA - numB;
    });

  const segments: TextSegment[] = [];

  for (const filename of slideFiles) {
    const xml = await zip.files[filename].async("string");
    const parsed: unknown = parser.parse(xml);
    const runs: string[] = [];
    collectTextRuns(parsed, runs);
    const text = runs.join(" ").replace(/\s+/g, " ").trim();
    if (!text) continue;

    const slideNum = filename.match(/slide(\d+)\.xml$/)?.[1] ?? "?";
    segments.push({ text, pageRef: `slide ${slideNum}` });
  }

  return segments;
}
