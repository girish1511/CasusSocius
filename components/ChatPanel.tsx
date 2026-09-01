"use client";

import { useEffect, useState } from "react";
import DocumentSelectModal from "./DocumentSelectModal";

interface DocOption {
  id: string;
  title: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  citations?: { documentId: string; documentTitle: string; pageRef: string | null }[];
}

function chipLabel(selected: string[], total: number, none: boolean) {
  if (none && selected.length === 0) return "None";
  if (selected.length === 0) return "None";
  if (selected.length === total) return "All";
  return `${selected.length} selected`;
}

export default function ChatPanel({ courseId }: { courseId: string }) {
  const [lectureDocs, setLectureDocs] = useState<DocOption[]>([]);
  const [quizDocs, setQuizDocs] = useState<DocOption[]>([]);
  const [lectureSelected, setLectureSelected] = useState<string[]>([]);
  const [quizSelected, setQuizSelected] = useState<string[]>([]);
  const [openModal, setOpenModal] = useState<"lecture" | "quiz" | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const [lectureRes, quizRes] = await Promise.all([
        fetch(`/api/documents?course_id=${courseId}&category=lecture`),
        fetch(`/api/documents?course_id=${courseId}&category=quiz_sample`),
      ]);
      const lecture = lectureRes.ok ? (await lectureRes.json()).documents : [];
      const quiz = quizRes.ok ? (await quizRes.json()).documents : [];
      setLectureDocs(lecture);
      setQuizDocs(quiz);
      // Default: "Lecture docs: All", "Quiz docs: None"
      setLectureSelected(lecture.map((d: DocOption) => d.id));
      setQuizSelected([]);
    }
    load();
  }, [courseId]);

  async function ask() {
    if (!question.trim() || loading) return;
    setError(null);
    setLoading(true);
    const userMessage: ChatMessage = { role: "user", content: question };
    setMessages((prev) => [...prev, userMessage]);
    setQuestion("");

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          course_id: courseId,
          question: userMessage.content,
          lecture_document_ids: lectureSelected,
          quiz_document_ids: quizSelected,
          session_id: sessionId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to get an answer");

      setSessionId(data.sessionId);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.answer, citations: data.citations },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to get an answer");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border border-surface-border bg-surface p-3">
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setOpenModal("lecture")}
          className="rounded-md border border-surface-border bg-background px-2.5 py-1 font-mono text-xs text-muted-strong hover:border-accent hover:text-accent"
        >
          Lecture docs: {chipLabel(lectureSelected, lectureDocs.length, false)}
        </button>
        <button
          onClick={() => setOpenModal("quiz")}
          className="rounded-md border border-surface-border bg-background px-2.5 py-1 font-mono text-xs text-muted-strong hover:border-accent hover:text-accent"
        >
          Quiz docs: {chipLabel(quizSelected, quizDocs.length, true)}
        </button>
      </div>

      <div className="flex max-h-96 min-h-32 flex-col gap-3 overflow-y-auto rounded-md border border-surface-border bg-background p-3">
        {messages.length === 0 && (
          <p className="text-sm text-muted-strong">
            Ask a question about the selected documents.
          </p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "text-right" : ""}>
            <p
              className={`inline-block max-w-[85%] rounded-md px-3 py-2 text-left text-sm ${
                m.role === "user"
                  ? "bg-accent/10 text-foreground"
                  : "bg-surface text-foreground"
              }`}
            >
              {m.content}
            </p>
            {m.citations && m.citations.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {m.citations.map((c, ci) => (
                  <span
                    key={ci}
                    className="rounded border border-accent/40 px-1.5 py-0.5 font-mono text-[10px] text-accent"
                  >
                    {c.documentTitle}
                    {c.pageRef ? `, ${c.pageRef}` : ""}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {error && <p className="text-xs text-status-error">{error}</p>}

      <div className="flex gap-2">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && ask()}
          placeholder="Ask a question..."
          className="flex-1 rounded-md border border-surface-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
        />
        <button
          onClick={ask}
          disabled={loading || !question.trim()}
          className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-background hover:opacity-90 disabled:opacity-40"
        >
          {loading ? "Asking..." : "Ask"}
        </button>
      </div>

      {openModal === "lecture" && (
        <DocumentSelectModal
          title="Lecture documents"
          mode="multi"
          documents={lectureDocs}
          initialSelectedIds={lectureSelected}
          onApply={(ids) => {
            setLectureSelected(ids);
            setOpenModal(null);
          }}
          onClose={() => setOpenModal(null)}
        />
      )}
      {openModal === "quiz" && (
        <DocumentSelectModal
          title="Quiz documents"
          mode="multi"
          documents={quizDocs}
          initialSelectedIds={quizSelected}
          onApply={(ids) => {
            setQuizSelected(ids);
            setOpenModal(null);
          }}
          onClose={() => setOpenModal(null)}
        />
      )}
    </div>
  );
}
