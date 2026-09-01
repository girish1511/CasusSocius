import Anthropic from "@anthropic-ai/sdk";
import { createServiceClient } from "../supabase/service";
import { DOCUMENTS_BUCKET } from "../documents/constants";
import { buildQuizFiles } from "./files";
import { validateChartSpec, type ChartSpec } from "./chart-spec";
import { renderChartPng } from "./chart-render";

const QUIZ_MODEL = "claude-sonnet-4-5";

// Cap how many chunks per document feed the prompt so a large course
// doesn't blow the context window — enough for good coverage without
// needing exhaustive retrieval (this isn't a targeted search, it's "use
// this material as the source").
const MAX_CHUNKS_PER_SOURCE_DOC = 12;
const MAX_STYLE_CHUNKS = 8;

export interface GeneratedQuiz {
  id: string;
  courseId: string;
  createdAt: string;
  quizFileUrl: string | null;
  solutionFileUrl: string | null;
}

interface QuizQuestionDraft {
  question: string;
  correct_answer: string;
  explanation: string;
  chart_spec?: unknown;
}

export interface QuizQuestionWithChart {
  question: string;
  correct_answer: string;
  explanation: string;
  chartImageUrl: string | null;
}

export async function generateQuiz(params: {
  courseId: string;
  sourceDocumentIds: string[];
  styleDocumentId: string | null;
  questionCount: number;
}): Promise<GeneratedQuiz> {
  const { courseId, sourceDocumentIds, styleDocumentId, questionCount } = params;
  if (sourceDocumentIds.length === 0) {
    throw new Error("Select at least one source document for the quiz.");
  }

  const supabase = createServiceClient();

  const sourceText = await gatherText(sourceDocumentIds, MAX_CHUNKS_PER_SOURCE_DOC);
  const styleText = styleDocumentId
    ? await gatherText([styleDocumentId], MAX_STYLE_CHUNKS)
    : null;

  const drafts = await draftQuestions(sourceText, styleText, questionCount);
  if (drafts.length === 0) {
    throw new Error("Quiz generation returned no questions.");
  }

  const { data: course } = await supabase
    .from("courses")
    .select("name")
    .eq("id", courseId)
    .single();

  const { data: quiz, error: quizError } = await supabase
    .from("quizzes")
    .insert({
      course_id: courseId,
      source_document_ids: sourceDocumentIds,
      style_reference_id: styleDocumentId,
    })
    .select("id, course_id, created_at")
    .single();
  if (quizError || !quiz) {
    throw new Error(`Failed to create quiz: ${quizError?.message}`);
  }

  // Validate each draft's chart_spec independently; a malformed one just
  // means that question renders as text-only, it never fails the batch.
  const questions: (QuizQuestionDraft & {
    validChartSpec: ChartSpec | null;
    chartImageUrl: string | null;
  })[] = [];

  for (const draft of drafts) {
    const validChartSpec = draft.chart_spec
      ? validateChartSpec(draft.chart_spec)
      : null;

    let chartImageUrl: string | null = null;
    if (validChartSpec) {
      try {
        chartImageUrl = await storeChartImage(quiz.id, questions.length, validChartSpec);
      } catch (err) {
        console.error("[quiz/generate] chart render/upload failed, skipping chart:", err);
      }
    }

    questions.push({ ...draft, validChartSpec, chartImageUrl });
  }

  const { error: questionsError } = await supabase.from("quiz_questions").insert(
    questions.map((q) => ({
      quiz_id: quiz.id,
      question: q.question,
      correct_answer: q.correct_answer,
      explanation: q.explanation,
      chart_spec: q.validChartSpec,
      chart_image_url: q.chartImageUrl,
    }))
  );
  if (questionsError) {
    throw new Error(`Failed to store quiz questions: ${questionsError.message}`);
  }

  const { quizFileUrl, solutionFileUrl } = await buildQuizFiles(
    quiz.id,
    course?.name ?? "Practice Quiz",
    questions.map((q) => ({
      question: q.question,
      correct_answer: q.correct_answer,
      explanation: q.explanation,
      chartImageUrl: q.chartImageUrl,
    }))
  );

  const { error: updateError } = await supabase
    .from("quizzes")
    .update({ quiz_file_url: quizFileUrl, solution_file_url: solutionFileUrl })
    .eq("id", quiz.id);
  if (updateError) {
    throw new Error(`Failed to save quiz files: ${updateError.message}`);
  }

  return {
    id: quiz.id,
    courseId: quiz.course_id,
    createdAt: quiz.created_at,
    quizFileUrl,
    solutionFileUrl,
  };
}

async function storeChartImage(
  quizId: string,
  questionIndex: number,
  chartSpec: ChartSpec
): Promise<string> {
  const supabase = createServiceClient();
  const png = await renderChartPng(chartSpec);
  const path = `quizzes/${quizId}/charts/q${questionIndex}.png`;

  const { error } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .upload(path, png, { contentType: "image/png", upsert: true });
  if (error) throw new Error(`Failed to store chart image: ${error.message}`);

  return supabase.storage.from(DOCUMENTS_BUCKET).getPublicUrl(path).data.publicUrl;
}

async function gatherText(documentIds: string[], perDocLimit: number): Promise<string> {
  const supabase = createServiceClient();
  const parts: string[] = [];

  for (const documentId of documentIds) {
    const { data } = await supabase
      .from("chunks")
      .select("content, page_ref")
      .eq("document_id", documentId)
      .limit(perDocLimit);

    for (const chunk of data ?? []) {
      parts.push(chunk.content);
    }
  }

  return parts.join("\n\n");
}

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

async function draftQuestions(
  sourceText: string,
  styleText: string | null,
  questionCount: number
): Promise<QuizQuestionDraft[]> {
  const anthropic = getClient();

  const system = `You are an MBA professor writing a practice quiz grounded strictly in the provided source material. Generate exactly ${questionCount} questions.${
    styleText
      ? " Match the format, difficulty, and style of the sample quiz provided below."
      : ""
  }

Respond with ONLY a JSON array (no prose, no markdown fences), where each element is:
{"question": "...", "correct_answer": "...", "explanation": "..."}

Do not include multiple-choice "options" fields or any grading rubric — just the question, the correct answer, and an explanation.

OPTIONAL CHART: a question may also include a "chart_spec" field, but only when the question genuinely cannot be answered (or would be significantly harder to understand) without seeing a visual — e.g. "given this supply and demand curve, find the equilibrium price" or "using this bar chart of quarterly revenue, calculate the growth rate". Most questions should have NO chart_spec at all — do not add one just to illustrate a concept that's clear from text alone, and do not add a chart to more than a small minority of the questions. When you do include one, it must match exactly:
{"chart_type": "bar" | "line" | "pie" | "scatter", "title": "...", "x_label": "...", "y_label": "...", "series": [{"name": "...", "data": [{"x": number, "y": number}, ...]}]}
Represent supply/demand or cost curves as two or more "line" series of points — there is no dedicated curve type.

Source material:
${sourceText}
${styleText ? `\nSample quiz style reference:\n${styleText}` : ""}`;

  const response = await anthropic.messages.create({
    model: QUIZ_MODEL,
    max_tokens: 4096,
    system,
    messages: [
      { role: "user", content: `Generate the ${questionCount}-question quiz now.` },
    ],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  const raw = textBlock?.type === "text" ? textBlock.text : "[]";

  try {
    const jsonText = raw.trim().replace(/^```json\s*|```$/g, "");
    const parsed = JSON.parse(jsonText);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (q): q is QuizQuestionDraft =>
        typeof q?.question === "string" &&
        typeof q?.correct_answer === "string" &&
        typeof q?.explanation === "string"
    );
  } catch {
    throw new Error("Failed to parse generated quiz output.");
  }
}
