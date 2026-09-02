-- Caches the generated document summary so reopening the same document
-- doesn't re-call Claude every time. Additive, nullable — a document with
-- no summary yet just falls back to generating on first open, same as
-- before.
alter table documents
  add column summary text,
  add column summary_truncated boolean not null default false,
  add column summary_generated_at timestamptz;
