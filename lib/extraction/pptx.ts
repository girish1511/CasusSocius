import JSZip from "jszip";
import { XMLParser } from "fast-xml-parser";
import type { ExtractedImage, ExtractionResult } from "./types";

const textParser = new XMLParser({
  ignoreAttributes: true,
  textNodeName: "#text",
});

const attrParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
});

const IMAGE_SIZE_THRESHOLD_BYTES = 5 * 1024;

const MIME_BY_EXTENSION: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  bmp: "image/bmp",
  webp: "image/webp",
};

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

// Recursively collects every r:embed relationship id referenced by a
// picture (<a:blip r:embed="rIdN"/>) anywhere in the slide's shape tree.
function collectBlipRelIds(node: unknown, out: string[]): void {
  if (node == null) return;
  if (Array.isArray(node)) {
    for (const item of node) collectBlipRelIds(item, out);
    return;
  }
  if (typeof node !== "object") return;

  const obj = node as Record<string, unknown>;
  const embedId = obj["@_r:embed"];
  if (typeof embedId === "string") out.push(embedId);

  for (const value of Object.values(obj)) collectBlipRelIds(value, out);
}

// PPTX is a zip of per-slide XML files (ppt/slides/slideN.xml). One segment
// per slide, so chunks can carry a slide number in page_ref. Images are
// resolved through each slide's relationship file (ppt/slides/_rels/
// slideN.xml.rels), which maps the r:embed ids referenced in the slide's
// <a:blip> elements to their actual media file in ppt/media/.
export async function extractPptx(buffer: Buffer): Promise<ExtractionResult> {
  const zip = await JSZip.loadAsync(buffer);

  const slideFiles = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => {
      const numA = Number(a.match(/slide(\d+)\.xml$/)?.[1] ?? 0);
      const numB = Number(b.match(/slide(\d+)\.xml$/)?.[1] ?? 0);
      return numA - numB;
    });

  const segments: ExtractionResult["segments"] = [];
  const images: ExtractedImage[] = [];

  for (const filename of slideFiles) {
    const slideNum = filename.match(/slide(\d+)\.xml$/)?.[1] ?? "?";
    const pageRef = `slide ${slideNum}`;
    const xml = await zip.files[filename].async("string");

    const textParsed: unknown = textParser.parse(xml);
    const runs: string[] = [];
    collectTextRuns(textParsed, runs);
    const text = runs.join(" ").replace(/\s+/g, " ").trim();
    if (text) segments.push({ text, pageRef });

    const slideImages = await resolveSlideImages(zip, filename, xml, pageRef);
    images.push(...slideImages);
  }

  return { segments, images };
}

async function resolveSlideImages(
  zip: JSZip,
  slideFilename: string,
  slideXml: string,
  pageRef: string
): Promise<ExtractedImage[]> {
  const attrParsed: unknown = attrParser.parse(slideXml);
  const embedIds: string[] = [];
  collectBlipRelIds(attrParsed, embedIds);
  if (embedIds.length === 0) return [];

  const slideName = slideFilename.split("/").pop();
  const relsFilename = `ppt/slides/_rels/${slideName}.rels`;
  const relsFile = zip.files[relsFilename];
  if (!relsFile) return [];

  const relsXml = await relsFile.async("string");
  const relsParsed = attrParser.parse(relsXml) as {
    Relationships?: { Relationship?: unknown };
  };
  const relationships = relsParsed.Relationships?.Relationship;
  const relationshipList = Array.isArray(relationships)
    ? relationships
    : relationships
      ? [relationships]
      : [];

  const targetById = new Map<string, string>();
  for (const rel of relationshipList as Record<string, string>[]) {
    const type = rel["@_Type"] ?? "";
    if (!type.includes("/image")) continue;
    const id = rel["@_Id"];
    const target = rel["@_Target"];
    if (id && target) targetById.set(id, target);
  }

  const images: ExtractedImage[] = [];
  for (const embedId of embedIds) {
    const target = targetById.get(embedId);
    if (!target) continue;

    // Targets are relative to ppt/slides/, e.g. "../media/image1.png".
    const mediaPath = new URL(target, "zip:///ppt/slides/").pathname.replace(/^\//, "");
    const ext = mediaPath.toLowerCase().split(".").pop() ?? "";
    const mimeType = MIME_BY_EXTENSION[ext];
    if (!mimeType) continue;

    const mediaFile = zip.files[mediaPath];
    if (!mediaFile) continue;

    const data = await mediaFile.async("uint8array");
    if (data.byteLength < IMAGE_SIZE_THRESHOLD_BYTES) continue;

    images.push({ data, mimeType, pageRef });
  }

  return images;
}
