import { createServiceClient } from "../supabase/service";
import { extractText, type SupportedDocumentType, type TextSegment } from "../extraction";
import { describeAndStoreImages, type DescribedImage } from "../extraction/images";
import { chunkSegments } from "../chunking/chunk";
import { embedTexts } from "../embeddings/openai";

const CHUNK_INSERT_BATCH_SIZE = 100;

// Folds each image's description into the segment sharing its page/slide
// locator (so it flows through the existing word-based chunker unchanged),
// creating a standalone segment when that page had no extractable text at
// all (e.g. a full-page chart with no surrounding prose).
function mergeImageDescriptions(
  segments: TextSegment[],
  described: DescribedImage[]
): TextSegment[] {
  if (described.length === 0) return segments;

  const merged = segments.map((s) => ({ ...s }));

  for (const image of described) {
    const figureText = `[Figure: ${image.description}]`;
    const target = merged.find((s) => s.pageRef === image.pageRef);
    if (target) {
      target.text = `${target.text}\n\n${figureText}`;
    } else {
      merged.push({ text: figureText, pageRef: image.pageRef });
    }
  }

  return merged;
}

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
    const { segments, images } = await extractText(type, buffer);

    // A document with no images is a no-op here: describeAndStoreImages
    // returns immediately and mergeImageDescriptions returns the original
    // segments untouched, so behavior matches today's text-only pipeline.
    const describedImages = await describeAndStoreImages(documentId, images);
    const mergedSegments = mergeImageDescriptions(segments, describedImages);

    const chunks = chunkSegments(mergedSegments);
    if (chunks.length === 0) {
      throw new Error("No extractable text found in document");
    }

    // First described image per page/slide becomes that chunk's image_url;
    // the description text itself (searchable) already covers every image,
    // this is just a display reference.
    const imageUrlByPageRef = new Map<string | null, string>();
    for (const image of describedImages) {
      if (!imageUrlByPageRef.has(image.pageRef)) {
        imageUrlByPageRef.set(image.pageRef, image.imageUrl);
      }
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
          image_url: imageUrlByPageRef.get(chunk.pageRef) ?? null,
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
