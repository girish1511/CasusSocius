import DocumentManager from "@/components/DocumentManager";

export default function DocumentsPage() {
  return (
    <main className="flex flex-1 flex-col items-center gap-6 p-8">
      <div className="text-center">
        <h1 className="font-serif text-2xl text-foreground">Documents</h1>
        <p className="text-sm text-muted-strong">
          Upload course material to make it available for chat, summaries, and quizzes.
        </p>
      </div>
      <DocumentManager />
    </main>
  );
}
