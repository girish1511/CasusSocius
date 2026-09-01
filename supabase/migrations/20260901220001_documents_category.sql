-- Distinguishes uploaded lecture material from sample quizzes/solutions
-- used as style references for quiz generation. Additive only — no other
-- schema changes. Filtering happens in the UI/API queries; the
-- extraction/chunking/embedding pipeline is unaffected.

alter table documents
  add column category text not null default 'lecture'
  constraint documents_category_check check (category in ('lecture', 'quiz_sample'));

create index documents_course_category_idx on documents (course_id, category);
