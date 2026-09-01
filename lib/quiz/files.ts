import { createServiceClient } from "../supabase/service";
import { DOCUMENTS_BUCKET } from "../documents/constants";
import { buildQuizPdf, buildSolutionPdf } from "./pdf";

interface QuizQuestionDraft {
  question: string;
  correct_answer: string;
  explanation: string;
  chartImageUrl?: string | null;
}

export async function buildQuizFiles(
  quizId: string,
  courseName: string,
  questions: QuizQuestionDraft[]
): Promise<{ quizFileUrl: string; solutionFileUrl: string }> {
  const supabase = createServiceClient();
  const generatedAt = new Date();

  const [quizPdfBytes, solutionPdfBytes] = await Promise.all([
    buildQuizPdf(courseName, generatedAt, questions),
    buildSolutionPdf(courseName, generatedAt, questions),
  ]);

  const quizPath = `quizzes/${quizId}/quiz.pdf`;
  const solutionPath = `quizzes/${quizId}/solution.pdf`;

  const [quizUpload, solutionUpload] = await Promise.all([
    supabase.storage.from(DOCUMENTS_BUCKET).upload(quizPath, quizPdfBytes, {
      contentType: "application/pdf",
      upsert: true,
    }),
    supabase.storage.from(DOCUMENTS_BUCKET).upload(solutionPath, solutionPdfBytes, {
      contentType: "application/pdf",
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
