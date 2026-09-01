import { NextResponse } from "next/server";
import { generateQuiz } from "@/lib/quiz/generate";

export async function POST(request: Request) {
  const body = await request.json();
  const {
    course_id: courseId,
    source_document_ids: sourceDocumentIds = [],
    style_document_id: styleDocumentId = null,
    question_count: questionCount = 10,
  } = body;

  if (typeof courseId !== "string") {
    return NextResponse.json({ error: "Missing course_id" }, { status: 400 });
  }

  const count = Math.min(50, Math.max(1, Number(questionCount) || 10));

  try {
    const quiz = await generateQuiz({
      courseId,
      sourceDocumentIds,
      styleDocumentId,
      questionCount: count,
    });
    return NextResponse.json({ quiz }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Quiz generation failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
