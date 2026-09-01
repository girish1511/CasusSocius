import { NextResponse } from "next/server";
import { answerQuestion } from "@/lib/chat/answer";

export async function POST(request: Request) {
  const body = await request.json();
  const {
    course_id: courseId,
    question,
    lecture_document_ids: lectureDocumentIds = [],
    quiz_document_ids: quizDocumentIds = [],
    session_id: sessionId = null,
  } = body;

  if (typeof courseId !== "string" || typeof question !== "string" || !question.trim()) {
    return NextResponse.json({ error: "Missing course_id or question" }, { status: 400 });
  }

  try {
    const result = await answerQuestion({
      courseId,
      question,
      lectureDocumentIds,
      quizDocumentIds,
      sessionId,
    });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to answer question";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
