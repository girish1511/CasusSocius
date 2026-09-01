"use client";

import { useState } from "react";
import Modal from "./Modal";

export default function AddSubjectModal({
  onCreate,
  onClose,
}: {
  onCreate: (name: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState("");

  return (
    <Modal
      title="Add subject"
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
            onClick={() => name.trim() && onCreate(name.trim())}
            disabled={!name.trim()}
            className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-background hover:opacity-90 disabled:opacity-40"
          >
            Add
          </button>
        </>
      }
    >
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="e.g. Operations Management"
        className="w-full rounded-md border border-surface-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
      />
    </Modal>
  );
}
