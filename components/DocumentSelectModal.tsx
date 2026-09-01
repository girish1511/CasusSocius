"use client";

import { useState } from "react";
import Modal from "./Modal";

interface DocOption {
  id: string;
  title: string;
}

export default function DocumentSelectModal({
  title,
  mode,
  documents,
  initialSelectedIds,
  onApply,
  onClose,
}: {
  title: string;
  mode: "multi" | "single";
  documents: DocOption[];
  initialSelectedIds: string[];
  onApply: (ids: string[]) => void;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(
    new Set(initialSelectedIds)
  );

  function toggle(id: string) {
    if (mode === "single") {
      setSelected(new Set([id]));
      return;
    }
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <Modal
      title={title}
      onClose={onClose}
      footer={
        <>
          <button
            onClick={onClose}
            className="rounded-md border border-surface-border px-3 py-1.5 text-sm text-muted-strong hover:text-foreground"
          >
            Cancel
          </button>
          <button
            onClick={() => onApply(Array.from(selected))}
            className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-background hover:opacity-90"
          >
            Apply
          </button>
        </>
      }
    >
      {mode === "multi" && (
        <div className="mb-3 flex gap-2">
          <button
            onClick={() => setSelected(new Set(documents.map((d) => d.id)))}
            className="text-xs text-accent hover:underline"
          >
            Select all
          </button>
          <button
            onClick={() => setSelected(new Set())}
            className="text-xs text-accent hover:underline"
          >
            None
          </button>
        </div>
      )}

      {documents.length === 0 && (
        <p className="text-sm text-muted-strong">No documents in this category yet.</p>
      )}

      <ul className="flex flex-col gap-1">
        {documents.map((doc) => (
          <li key={doc.id}>
            <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-foreground hover:bg-background">
              <input
                type={mode === "single" ? "radio" : "checkbox"}
                checked={selected.has(doc.id)}
                onChange={() => toggle(doc.id)}
                className="accent-accent"
              />
              {doc.title}
            </label>
          </li>
        ))}
      </ul>
    </Modal>
  );
}
