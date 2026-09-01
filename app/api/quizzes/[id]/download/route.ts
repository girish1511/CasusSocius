import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const fileType = searchParams.get("type");
  if (fileType !== "quiz" && fileType !== "solution") {
    return NextResponse.json({ error: "type must be 'quiz' or 'solution'" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("quizzes")
    .select("quiz_file_url, solution_file_url")
    .eq("id", id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
  }

  const url = fileType === "quiz" ? data.quiz_file_url : data.solution_file_url;
  if (!url) {
    return NextResponse.json({ error: "File not available" }, { status: 404 });
  }

  return NextResponse.redirect(url);
}
