"use client";

import DocumentGrid from "./DocumentGrid";
import ChatPanel from "./ChatPanel";
import QuizPanel from "./QuizPanel";

export default function SubjectView({ courseId }: { courseId: string }) {
  return (
    <div key={courseId} className="flex flex-col gap-8 p-6">
      <section className="flex flex-col gap-2">
        <h2 className="font-serif text-lg text-foreground">Documents</h2>
        <div className="flex flex-col gap-3 md:flex-row">
          <DocumentGrid
            courseId={courseId}
            category="lecture"
            label="Lecture materials"
          />
          <DocumentGrid
            courseId={courseId}
            category="quiz_sample"
            label="Sample quizzes & solutions"
          />
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-serif text-lg text-foreground">Ask a question</h2>
        <ChatPanel courseId={courseId} />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-serif text-lg text-foreground">Practice quiz</h2>
        <QuizPanel courseId={courseId} />
      </section>
    </div>
  );
}
