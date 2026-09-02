import { randomUUID } from "crypto";
import Anthropic from "@anthropic-ai/sdk";
import { createServiceClient } from "../supabase/service";
import { DOCUMENTS_BUCKET } from "../documents/constants";
import type { ExtractedImage } from "./types";

const VISION_MODEL = "claude-sonnet-4-5";

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

function extensionFor(mimeType: string): string {
  if (mimeType === "image/jpeg" || mimeType === "image/jpg") return "jpg";
  if (mimeType === "image/gif") return "gif";
  if (mimeType === "image/webp") return "webp";
  return "png";
}

async function uploadImage(documentId: string, image: ExtractedImage): Promise<string> {
  const supabase = createServiceClient();
  const path = `documents/${documentId}/images/${randomUUID()}.${extensionFor(image.mimeType)}`;

  const { error } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .upload(path, image.data, { contentType: image.mimeType, upsert: true });
  if (error) throw new Error(`Failed to store extracted image: ${error.message}`);

  return supabase.storage.from(DOCUMENTS_BUCKET).getPublicUrl(path).data.publicUrl;
}

async function describeImage(image: ExtractedImage): Promise<string> {
  const anthropic = getClient();
  const base64 = Buffer.from(image.data).toString("base64");

  const response = await anthropic.messages.create({
    model: VISION_MODEL,
    max_tokens: 512,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: image.mimeType as "image/png" | "image/jpeg" | "image/gif" | "image/webp", data: base64 },
          },
          {
            type: "text",
            text: "Describe this image factually and in enough detail to answer questions about it later, without seeing it again. If it's a chart or graph, state the chart type, axis labels, and the key data points or trend. If it's a diagram, describe its structure and labeled parts. If it's decorative (a logo, icon, or photo with no informational content), say so in one short sentence instead of inventing detail.",
          },
        ],
      },
    ],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  return textBlock?.type === "text" ? textBlock.text.trim() : "";
}

export interface DescribedImage {
  pageRef: string | null;
  imageUrl: string;
  description: string;
}

// Uploads + describes each extracted image, skipping (and logging) any that
// fail individually rather than aborting the whole document's pipeline —
// one bad image never blocks the rest of extraction.
export async function describeAndStoreImages(
  documentId: string,
  images: ExtractedImage[]
): Promise<DescribedImage[]> {
  const results: DescribedImage[] = [];

  for (const image of images) {
    try {
      const [imageUrl, description] = await Promise.all([
        uploadImage(documentId, image),
        describeImage(image),
      ]);
      if (!description) continue;
      results.push({ pageRef: image.pageRef, imageUrl, description });
    } catch (err) {
      console.error("[extraction/images] failed to process an image, skipping:", err);
    }
  }

  return results;
}
