"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface DocumentRow {
  id: string;
  title: string;
  type: string;
  status: "processing" | "ready" | "error" | string;
  uploaded_at: string;
  file_url: string;
}

const ACCEPTED_EXTENSIONS = [".pdf", ".docx", ".pptx", ".txt"];
const POLL_INTERVAL_MS = 2000;

function statusBadgeClasses(status: string) {
  switch (status) {
    case "ready":
      return "bg-green-100 text-green-800";
    case "error":
      return "bg-red-100 text-red-800";
    default:
      return "bg-yellow-100 text-yellow-800";
  }
}

export default function DocumentManager() {
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refreshList = useCallback(async () => {
    const res = await fetch("/api/documents");
    if (!res.ok) return;
    const { documents } = await res.json();
    setDocuments(documents);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch-on-mount
    refreshList();
  }, [refreshList]);

  // Poll any document still 'processing' until it settles to ready/error.
  useEffect(() => {
    const pending = documents.filter((d) => d.status === "processing");
    if (pending.length === 0) return;

    const interval = setInterval(async () => {
      const updates = await Promise.all(
        pending.map(async (doc) => {
          const res = await fetch(`/api/documents/${doc.id}`);
          if (!res.ok) return null;
          const { document } = await res.json();
          return document as DocumentRow;
        })
      );

      setDocuments((prev) =>
        prev.map((doc) => {
          const updated = updates.find((u) => u?.id === doc.id);
          return updated ?? doc;
        })
      );
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [documents]);

  const uploadFile = useCallback(
    async (file: File) => {
      setUploadError(null);
      const ext = "." + file.name.toLowerCase().split(".").pop();
      if (!ACCEPTED_EXTENSIONS.includes(ext)) {
        setUploadError(
          `Unsupported file type "${ext}". Use PDF, DOCX, PPTX, or TXT.`
        );
        return;
      }

      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/documents/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: "Upload failed" }));
        setUploadError(error ?? "Upload failed");
        return;
      }

      const { document } = await res.json();
      setDocuments((prev) => [document, ...prev]);
    },
    []
  );

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files) return;
      Array.from(files).forEach((file) => uploadFile(file));
    },
    [uploadFile]
  );

  return (
    <div className="w-full max-w-2xl flex flex-col gap-6">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          handleFiles(e.dataTransfer.files);
        }}
        onClick={() => fileInputRef.current?.click()}
        className={`cursor-pointer rounded-lg border-2 border-dashed p-10 text-center transition-colors ${
          isDragging
            ? "border-blue-500 bg-blue-50"
            : "border-gray-300 hover:border-gray-400"
        }`}
      >
        <p className="text-sm text-gray-600">
          Drag and drop a file here, or click to choose one
        </p>
        <p className="mt-1 text-xs text-gray-400">
          PDF, DOCX, PPTX, or TXT
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_EXTENSIONS.join(",")}
          className="hidden"
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {uploadError && (
        <p className="text-sm text-red-600">{uploadError}</p>
      )}

      {documents.length > 0 && (
        <ul className="flex flex-col gap-2">
          {documents.map((doc) => (
            <li
              key={doc.id}
              className="flex items-center justify-between rounded-md border border-gray-200 px-4 py-3"
            >
              <div className="flex flex-col">
                <span className="text-sm font-medium">{doc.title}</span>
                <span className="text-xs text-gray-400 uppercase">
                  {doc.type}
                </span>
              </div>
              <span
                className={`rounded-full px-2 py-1 text-xs font-medium ${statusBadgeClasses(
                  doc.status
                )}`}
              >
                {doc.status}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
