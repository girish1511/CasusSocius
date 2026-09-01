import Link from "next/link";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-2xl font-semibold">MBA Study Assistant</h1>
      <p className="text-sm text-gray-500">Upload course material to get started.</p>
      <Link
        href="/documents"
        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >
        Manage documents
      </Link>
    </main>
  );
}
