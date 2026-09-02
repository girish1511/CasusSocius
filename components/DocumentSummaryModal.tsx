"use client";

import { useEffect, useState } from "react";
import Modal from "./Modal";
import MarkdownMessage from "./MarkdownMessage";
import type { DocumentRow } from "./DocumentGrid";

// Keyed by document.id from the parent, so React remounts this fresh for
// each newly clicked tile — no stale summary from a previous document, and
// the fetch-on-mount effect only ever fires once per open document (it
// can't double-fire on a second click of the same tile, since the tile
// click handler is guarded to no-op while this modal is already open for
// that id).
export default function DocumentSummaryModal({
  document,
  onClose,
}: {
  document: DocumentRow;
  onClose: () => void;
}) {
  const [summary, setSummary] = useState<string | null>(null);
  const [truncated, setTruncated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(document.status === "ready");

  useEffect(() => {
    if (document.status !== "ready") return;

    const controller = new AbortController();
    fetch(`/api/documents/${document.id}/summarize`, {
      method: "POST",
      signal: controller.signal,
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to summarize document");
        setSummary(data.summary);
        setTruncated(data.truncated);
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Failed to summarize document");
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
    // document.id is the effective dependency; this component is remounted
    // (fresh state) whenever the parent switches to a different document.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Modal title="Summary" onClose={onClose}>
      {document.status === "processing" && (
        <p className="text-sm text-muted-strong">
          Still processing — try again shortly.
        </p>
      )}

      {document.status === "error" && (
        <p className="text-sm text-status-error">
          Processing failed for this document, so it can&apos;t be summarized.
        </p>
      )}

      {document.status === "ready" && loading && (
        <p className="animate-pulse text-sm text-accent">Summarizing…</p>
      )}

      {document.status === "ready" && !loading && error && (
        <p className="text-sm text-status-error">{error}</p>
      )}

      {document.status === "ready" && !loading && summary && (
        <div className="flex flex-col gap-2">
          <MarkdownMessage content={summary} />
          {truncated && (
            <p className="text-xs text-muted-strong">
              This document was too long to summarize in full — summary is based on
              its first portion.
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}
