import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { summarizeDocument } from "@/lib/documents/summarize";

// Deliberately not persisted (no table write) and no chat_sessions/
// chat_messages rows — this is a standalone, on-demand action per
// Phase 3 scope, not part of the chat feature.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createServiceClient();

  const { data: document, error } = await supabase
    .from("documents")
    .select("status")
    .eq("id", id)
    .single();

  if (error || !document) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }
  if (document.status !== "ready") {
    return NextResponse.json(
      { error: `Document is not ready (status: ${document.status})` },
      { status: 409 }
    );
  }

  try {
    const result = await summarizeDocument(id);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to summarize document";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
