import Link from "next/link";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="font-serif text-3xl text-foreground">CasusSocius</h1>
      <p className="text-sm text-muted-strong">
        Upload course material to get started.
      </p>
      <Link
        href="/documents"
        className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-background hover:opacity-90"
      >
        Manage documents
      </Link>
    </main>
  );
}
