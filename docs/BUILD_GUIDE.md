# Build Guide — Claude Code Prompts

Copy-paste prompts for each roadmap phase. Run them in order from the repo root with Claude Code (`claude` in terminal, or the desktop/VS Code app). Each assumes `CLAUDE.md` is in the repo root so Claude Code has context automatically.

Before starting: make sure `docs/project-plan.md` (the full plan) is committed to the repo, and your `.env.local` has placeholders for `ANTHROPIC_API_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and your embeddings provider key.

---

## Phase 0 — Setup

```
Scaffold a new Next.js (App Router, TypeScript, Tailwind) project for the MBA Study Assistant
described in docs/project-plan.md. Set up:
- Supabase client (browser + server helpers)
- Environment variable structure for ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY, and an embeddings provider key
- A /lib folder for shared logic (empty for now, just the structure)
- Basic folder structure: /app, /lib, /components, /docs
- A README with setup instructions (how to run locally, how to set env vars)
Don't build any features yet — just the skeleton and config.
```

Then: create the Supabase project tables from the data model in the plan, and enable the `pgvector` extension. Prompt:

```
Write a SQL migration file (supabase/migrations/) that creates the tables defined in
docs/project-plan.md section 5 (Data Model): courses, documents, chunks, chat_sessions,
chat_messages, quizzes, quiz_questions, quiz_attempts. Enable the pgvector extension and
use a vector column for chunks.embedding (dimension matching text-embedding-3-small, 1536).
Add appropriate foreign keys and indexes (including an ivfflat or hnsw index on the
embedding column for similarity search).
```

---

## Phase 1 — Document Pipeline

```
Build the document upload and processing pipeline per docs/project-plan.md section 4
(Document pipeline):
1. An upload UI (drag-and-drop or file picker) supporting PDF, DOCX, PPTX, TXT
2. On upload: store the raw file in Supabase Storage, create a `documents` row with
   status 'processing'
3. A server-side extraction step that pulls text from each file type
4. Chunk the extracted text (~500-800 tokens, with overlap) and store rows in `chunks`
5. Generate embeddings for each chunk (via the embeddings provider) and store them in
   the vector column
6. Update the document's status to 'ready' when done
Put the extraction/chunking/embedding logic in /lib so it's reusable. Show upload
progress and final status in the UI.
```

---

## Phase 2 — Chat / Q&A

```
Build the chat/Q&A feature per docs/project-plan.md section 4 (Chat/Q&A flow):
1. A retrieval function in /lib that embeds a user question and does a similarity search
   against `chunks` via pgvector, returning top-k relevant chunks (scoped to a course if
   selected)
2. An API route that takes a user question, retrieves relevant chunks, sends them as
   context to the Claude API along with the question, and returns a grounded answer
3. A chat UI (message list + input) that displays the answer and shows which
   document/chunk it was grounded in (a simple citation reference is enough for v1)
4. Persist chat_sessions and chat_messages to Supabase
Follow CLAUDE.md's rule that answers must be grounded in retrieved chunks, not general
knowledge, when relevant documents exist.
```

---

## Phase 3 — Summarization

```
Add a summarization feature: given a document (or a selected range of its chunks),
call the Claude API to produce a concise summary. Add a "Summarize" button on the
document view that calls this and displays the result. Keep it simple — no need to
persist summaries yet unless it's trivial to add.
```

---

## Phase 4 — Quiz Generation & Taking

```
Build quiz generation and taking per docs/project-plan.md section 4 (Quiz generation flow)
and CLAUDE.md's rule that quizzes are self-graded (no auto-grading logic):
1. A sample-quiz upload flow that lets the user upload a reference quiz to capture its
   format/style
2. An API route that takes the sample quiz + selected source material (document or
   course), retrieves relevant chunks, and prompts Claude to generate N new questions
   in matching style — each with a question, correct_answer, and explanation. Store as
   a `quizzes` row + `quiz_questions` rows.
3. A quiz-taking UI: show questions one at a time (or all at once) with answers hidden,
   let the user attempt them, then reveal the answer key/explanations and let the user
   mark each question as correct/incorrect themselves
4. Store the self-marked results in `quiz_attempts` (self_marked_results jsonb)
Do not build any answer-checking or grading logic — correctness is entirely
self-reported by the user.
```

---

## Phase 5 — Polish (pick as needed)

```
Add course/topic organization: a `courses` CRUD UI, and let documents/chats/quizzes
be filtered by course.
```

```
Add a simple progress view: list past quiz_attempts with self-marked scores, grouped
by course/topic, to surface weak areas over time.
```

```
Add spaced repetition: resurface quiz_questions the user previously marked incorrect,
prioritized in future quiz generation or a dedicated "review" mode.
```

---

## Tips for using these prompts

- Run one phase at a time — don't paste multiple phases into a single Claude Code session.
- After each phase, review the diff/changes before moving to the next prompt.
- If Claude Code proposes deviating from the tech stack or schema in CLAUDE.md, it should flag that rather than doing it silently — if it doesn't, redirect it back to CLAUDE.md.
- Feel free to append extra constraints to any prompt above (e.g. "keep this under 200 lines," "add basic error handling for upload failures").
