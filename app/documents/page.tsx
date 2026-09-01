import DocumentManager from "@/components/DocumentManager";

export default function DocumentsPage() {
  return (
    <main className="flex flex-1 flex-col items-center gap-8 p-8">
      <div className="text-center">
        <h1 className="text-2xl font-semibold">Documents</h1>
        <p className="text-sm text-gray-500">
          Upload course material to make it available for chat, summaries, and quizzes.
        </p>
      </div>
      <DocumentManager />
    </main>
  );
}
