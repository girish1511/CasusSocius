import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createServiceClient } from "@/lib/supabase/service";
import { documentTypeFromFilename } from "@/lib/extraction";
import { processDocument } from "@/lib/documents/pipeline";
import { DOCUMENTS_BUCKET, MAX_FILE_SIZE_BYTES } from "@/lib/documents/constants";

// Thin route: validates the upload, stores the raw file, creates the
// `documents` row, and hands off to /lib for extraction/chunking/embedding.
// Processing runs fire-and-forget so the client gets an id to poll
// immediately instead of waiting for a potentially long pipeline.
export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file");
  const courseId = formData.get("course_id");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  const type = documentTypeFromFilename(file.name);
  if (!type) {
    return NextResponse.json(
      { error: "Unsupported file type. Use PDF, DOCX, PPTX, or TXT." },
      { status: 400 }
    );
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json(
      { error: `File exceeds ${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB limit` },
      { status: 400 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const supabase = createServiceClient();

  const storagePath = `${randomUUID()}-${file.name}`;
  const { error: uploadError } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .upload(storagePath, buffer, { contentType: file.type });

  if (uploadError) {
    return NextResponse.json(
      { error: `Storage upload failed: ${uploadError.message}` },
      { status: 500 }
    );
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(DOCUMENTS_BUCKET).getPublicUrl(storagePath);

  const { data: document, error: insertError } = await supabase
    .from("documents")
    .insert({
      course_id: typeof courseId === "string" && courseId ? courseId : null,
      title: file.name,
      file_url: publicUrl,
      type,
      status: "processing",
    })
    .select()
    .single();

  if (insertError || !document) {
    return NextResponse.json(
      { error: `Failed to create document record: ${insertError?.message}` },
      { status: 500 }
    );
  }

  // Fire-and-forget: don't block the response on the full pipeline.
  void processDocument(document.id, buffer, type);

  return NextResponse.json({ document }, { status: 201 });
}
