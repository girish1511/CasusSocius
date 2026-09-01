"use client";

import { useCallback, useEffect, useState } from "react";
import DocumentSelectModal from "./DocumentSelectModal";

interface DocOption {
  id: string;
  title: string;
}

interface QuizRow {
  id: string;
  created_at: string;
  quiz_file_url: string | null;
  solution_file_url: string | null;
}

export default function QuizPanel({ courseId }: { courseId: string }) {
  const [sourceDocs, setSourceDocs] = useState<DocOption[]>([]);
  const [styleDocs, setStyleDocs] = useState<DocOption[]>([]);
  const [sourceSelected, setSourceSelected] = useState<string[]>([]);
  const [styleSelected, setStyleSelected] = useState<string[]>([]);
  const [openModal, setOpenModal] = useState<"source" | "style" | null>(null);
  const [questionCount, setQuestionCount] = useState(10);
  const [quizzes, setQuizzes] = useState<QuizRow[]>([]);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshQuizzes = useCallback(async () => {
    const res = await fetch(`/api/quizzes?course_id=${courseId}`);
    if (!res.ok) return;
    const { quizzes } = await res.json();
    setQuizzes(quizzes);
  }, [courseId]);

  useEffect(() => {
    async function load() {
      const [sourceRes, styleRes] = await Promise.all([
        fetch(`/api/documents?course_id=${courseId}&category=lecture`),
        fetch(`/api/documents?course_id=${courseId}&category=quiz_sample`),
      ]);
      const source = sourceRes.ok ? (await sourceRes.json()).documents : [];
      const style = styleRes.ok ? (await styleRes.json()).documents : [];
      setSourceDocs(source);
      setStyleDocs(style);
      setSourceSelected(source.map((d: DocOption) => d.id));
      setStyleSelected([]);
    }
    load();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch-on-mount / course switch
    refreshQuizzes();
  }, [courseId, refreshQuizzes]);

  function sourceLabel() {
    if (sourceSelected.length === 0) return "None";
    if (sourceSelected.length === sourceDocs.length) return "All lecture docs";
    return `${sourceSelected.length} selected`;
  }

  function styleLabel() {
    if (styleSelected.length === 0) return "None";
    const doc = styleDocs.find((d) => d.id === styleSelected[0]);
    return doc?.title ?? "None";
  }

  async function takeQuiz() {
    setError(null);
    setGenerating(true);
    try {
      const res = await fetch("/api/quizzes/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          course_id: courseId,
          source_document_ids: sourceSelected,
          style_document_id: styleSelected[0] ?? null,
          question_count: questionCount,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Quiz generation failed");
      await refreshQuizzes();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Quiz generation failed");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-md border border-surface-border bg-surface p-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setOpenModal("source")}
          className="rounded-md border border-surface-border bg-background px-2.5 py-1 font-mono text-xs text-muted-strong hover:border-accent hover:text-accent"
        >
          Source: {sourceLabel()}
        </button>
        <button
          onClick={() => setOpenModal("style")}
          className="rounded-md border border-surface-border bg-background px-2.5 py-1 font-mono text-xs text-muted-strong hover:border-accent hover:text-accent"
        >
          Style: {styleLabel()}
        </button>
        <label className="flex items-center gap-2 font-mono text-xs text-muted-strong">
          Questions
          <input
            type="number"
            min={1}
            max={50}
            value={questionCount}
            onChange={(e) =>
              setQuestionCount(
                Math.min(50, Math.max(1, Number(e.target.value) || 1))
              )
            }
            className="w-16 rounded-md border border-surface-border bg-background px-2 py-1 text-foreground outline-none focus:border-accent"
          />
        </label>
        <button
          onClick={takeQuiz}
          disabled={generating || sourceSelected.length === 0}
          className="ml-auto rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-background hover:opacity-90 disabled:opacity-40"
        >
          {generating ? "Generating..." : "Take a quiz"}
        </button>
      </div>

      {error && <p className="text-xs text-status-error">{error}</p>}

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-medium text-foreground">Generated quizzes</h3>
        {quizzes.length === 0 && (
          <p className="text-sm text-muted-strong">No quizzes generated yet.</p>
        )}
        <ul className="flex flex-col gap-2">
          {quizzes.map((quiz) => (
            <li
              key={quiz.id}
              className="flex items-center justify-between rounded-md border border-surface-border bg-background px-3 py-2"
            >
              <span className="font-mono text-xs text-muted-strong">
                {new Date(quiz.created_at).toLocaleString()}
              </span>
              <div className="flex gap-2">
                <a
                  href={`/api/quizzes/${quiz.id}/download?type=quiz`}
                  className="rounded-md border border-surface-border px-2 py-1 text-xs text-foreground hover:border-accent hover:text-accent"
                >
                  Quiz
                </a>
                <a
                  href={`/api/quizzes/${quiz.id}/download?type=solution`}
                  className="rounded-md border border-surface-border px-2 py-1 text-xs text-foreground hover:border-accent hover:text-accent"
                >
                  Solution
                </a>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {openModal === "source" && (
        <DocumentSelectModal
          title="Source documents"
          mode="multi"
          documents={sourceDocs}
          initialSelectedIds={sourceSelected}
          onApply={(ids) => {
            setSourceSelected(ids);
            setOpenModal(null);
          }}
          onClose={() => setOpenModal(null)}
        />
      )}
      {openModal === "style" && (
        <DocumentSelectModal
          title="Style reference"
          mode="single"
          documents={styleDocs}
          initialSelectedIds={styleSelected}
          onApply={(ids) => {
            setStyleSelected(ids);
            setOpenModal(null);
          }}
          onClose={() => setOpenModal(null)}
        />
      )}
    </div>
  );
}
