import { createServiceClient } from "../supabase/service";
import { DOCUMENTS_BUCKET } from "../documents/constants";

// Plain text, not PDF: it's trivially reliable to generate (no layout/PDF
// library involved) and perfectly readable for a personal study tool. If a
// PDF is wanted later, this is the one place that needs to change.
interface QuizQuestionDraft {
  question: string;
  correct_answer: string;
  explanation: string;
}

export async function buildQuizFiles(
  quizId: string,
  questions: QuizQuestionDraft[]
): Promise<{ quizFileUrl: string; solutionFileUrl: string }> {
  const supabase = createServiceClient();

  const quizText = questions
    .map((q, i) => `${i + 1}. ${q.question}`)
    .join("\n\n");

  const solutionText = questions
    .map(
      (q, i) =>
        `${i + 1}. ${q.question}\n\nAnswer: ${q.correct_answer}\n\nExplanation: ${q.explanation}`
    )
    .join("\n\n---\n\n");

  const quizPath = `quizzes/${quizId}/quiz.txt`;
  const solutionPath = `quizzes/${quizId}/solution.txt`;

  const [quizUpload, solutionUpload] = await Promise.all([
    supabase.storage
      .from(DOCUMENTS_BUCKET)
      .upload(quizPath, quizText, { contentType: "text/plain", upsert: true }),
    supabase.storage
      .from(DOCUMENTS_BUCKET)
      .upload(solutionPath, solutionText, {
        contentType: "text/plain",
        upsert: true,
      }),
  ]);

  if (quizUpload.error) {
    throw new Error(`Failed to store quiz file: ${quizUpload.error.message}`);
  }
  if (solutionUpload.error) {
    throw new Error(`Failed to store solution file: ${solutionUpload.error.message}`);
  }

  return {
    quizFileUrl: supabase.storage.from(DOCUMENTS_BUCKET).getPublicUrl(quizPath)
      .data.publicUrl,
    solutionFileUrl: supabase.storage
      .from(DOCUMENTS_BUCKET)
      .getPublicUrl(solutionPath).data.publicUrl,
  };
}
