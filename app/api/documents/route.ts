import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const courseId = searchParams.get("course_id");
  const category = searchParams.get("category");

  const supabase = createServiceClient();
  let query = supabase
    .from("documents")
    .select("id, title, type, category, status, uploaded_at, file_url, course_id")
    .order("uploaded_at", { ascending: false });

  if (courseId) query = query.eq("course_id", courseId);
  if (category) query = query.eq("category", category);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ documents: data });
}
