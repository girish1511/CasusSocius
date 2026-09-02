"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus } from "@fortawesome/free-solid-svg-icons";
import FileTypeIcon from "./FileTypeIcon";
import DocumentSummaryModal from "./DocumentSummaryModal";

export interface DocumentRow {
  id: string;
  title: string;
  type: string;
  category: string;
  status: string;
}

const ACCEPTED_EXTENSIONS = [".pdf", ".docx", ".pptx", ".txt"];
const POLL_INTERVAL_MS = 3000;

export default function DocumentGrid({
  courseId,
  category,
  label,
  onChanged,
}: {
  courseId: string;
  category: "lecture" | "quiz_sample";
  label: string;
  onChanged?: () => void;
}) {
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [summaryDoc, setSummaryDoc] = useState<DocumentRow | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    const res = await fetch(
      `/api/documents?course_id=${courseId}&category=${category}`
    );
    if (!res.ok) return;
    const { documents } = await res.json();
    setDocuments(documents);
  }, [courseId, category]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch-on-mount / course switch
    refresh();
  }, [refresh]);

  // Silently poll while anything here is still processing (no visible
  // status badge per design — icon-only tiles).
  useEffect(() => {
    if (!documents.some((d) => d.status === "processing")) return;
    const interval = setInterval(refresh, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [documents, refresh]);

  const uploadFile = useCallback(
    async (file: File) => {
      setError(null);
      const ext = "." + file.name.toLowerCase().split(".").pop();
      if (!ACCEPTED_EXTENSIONS.includes(ext)) {
        setError(`Unsupported file type "${ext}".`);
        return;
      }

      const formData = new FormData();
      formData.append("file", file);
      formData.append("course_id", courseId);
      formData.append("category", category);

      const res = await fetch("/api/documents/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: "Upload failed" }));
        setError(error ?? "Upload failed");
        return;
      }

      const { document } = await res.json();
      setDocuments((prev) => [document, ...prev]);
      onChanged?.();
    },
    [courseId, category, onChanged]
  );

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-2 rounded-md border border-surface-border bg-surface p-3">
      <h3 className="text-sm font-medium text-foreground">{label}</h3>
      {error && <p className="text-xs text-status-error">{error}</p>}
      <div className="grid max-h-64 grid-cols-2 gap-2 overflow-y-auto pr-1">
        {documents.map((doc) => (
          <button
            key={doc.id}
            title={doc.title}
            onClick={() => {
              // No-op if a summary is already open for this exact document
              // — avoids firing a second in-flight request from a repeat
              // click while it's still loading.
              if (summaryDoc?.id === doc.id) return;
              setSummaryDoc(doc);
            }}
            className="flex items-center gap-2 rounded-md border border-surface-border bg-background px-2 py-2 text-left transition-colors hover:border-accent hover:bg-accent/5"
          >
            <FileTypeIcon type={doc.type} />
            <span className="truncate text-xs text-foreground">{doc.title}</span>
          </button>
        ))}

        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center justify-center gap-2 rounded-md border border-dashed border-surface-border px-2 py-2 text-muted-strong hover:border-accent hover:text-accent"
        >
          <FontAwesomeIcon icon={faPlus} className="h-3.5 w-3.5" />
          <span className="text-xs">Upload</span>
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_EXTENSIONS.join(",")}
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.[0]) uploadFile(e.target.files[0]);
          e.target.value = "";
        }}
      />

      {summaryDoc && (
        <DocumentSummaryModal
          key={summaryDoc.id}
          document={summaryDoc}
          onClose={() => setSummaryDoc(null)}
        />
      )}
    </div>
  );
}
