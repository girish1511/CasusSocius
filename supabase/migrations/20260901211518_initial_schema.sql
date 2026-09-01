-- Initial schema for MBA Study Assistant.
-- Tables and columns match docs/project-plan.md section 5 (Data Model).
-- Do not rename or restructure per CLAUDE.md "Core Design Rules" #3 without
-- flagging it first. quiz_questions intentionally has no `options` or
-- grading columns — quizzes are self-graded (CLAUDE.md rule #2).

create extension if not exists vector;

create table courses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  created_at timestamptz not null default now()
);

create table documents (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses (id) on delete cascade,
  title text not null,
  file_url text not null,
  type text not null,
  uploaded_at timestamptz not null default now(),
  status text not null default 'pending'
);

create index documents_course_id_idx on documents (course_id);

create table chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents (id) on delete cascade,
  content text not null,
  embedding vector(1536),
  page_ref text
);

create index chunks_document_id_idx on chunks (document_id);

-- Approximate nearest-neighbor index for similarity search.
-- ivfflat requires rows in the table to build well-distributed lists;
-- with an empty table this still creates the index with default lists (100).
create index chunks_embedding_idx on chunks
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

create table chat_sessions (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index chat_sessions_course_id_idx on chat_sessions (course_id);

create table chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references chat_sessions (id) on delete cascade,
  role text not null,
  content text not null,
  cited_chunk_ids uuid[] not null default '{}',
  created_at timestamptz not null default now()
);

create index chat_messages_session_id_idx on chat_messages (session_id);

create table quizzes (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses (id) on delete cascade,
  source_document_ids uuid[] not null default '{}',
  style_reference_id uuid references documents (id) on delete set null,
  created_at timestamptz not null default now()
);

create index quizzes_course_id_idx on quizzes (course_id);

create table quiz_questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references quizzes (id) on delete cascade,
  question text not null,
  correct_answer text not null,
  explanation text not null
);

create index quiz_questions_quiz_id_idx on quiz_questions (quiz_id);

create table quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references quizzes (id) on delete cascade,
  self_marked_results jsonb not null default '[]',
  completed_at timestamptz
);

create index quiz_attempts_quiz_id_idx on quiz_attempts (quiz_id);
