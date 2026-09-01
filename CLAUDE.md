# CLAUDE.md

Persistent context for Claude Code when working in this repo. Read this before making changes.

## Project

MBA Study Assistant — a personal web app to study for MBA coursework by chatting with uploaded course material, generating summaries, and generating self-graded practice quizzes from sample quizzes.

Full spec: see `docs/project-plan.md` in this repo (copy of the original project plan — architecture, data model, roadmap all live there). Treat it as the source of truth for scope; don't silently deviate from it.

## Role

Act as a senior full-stack developer. When a decision touches how study content should be structured or evaluated (quiz question quality, summary depth, what a good explanation looks like), apply MBA-professor-level judgment about pedagogy — not just "does it run."

## Tech Stack (do not swap without asking)

- **Frontend:** Next.js (App Router) + React + Tailwind
- **Backend:** Next.js API routes (or a small Node service on Railway if it grows beyond that)
- **Database:** Supabase Postgres
- **Vector store:** Supabase `pgvector` extension — do NOT introduce a separate vector DB (Pinecone, Weaviate, etc.)
- **File storage:** Supabase Storage
- **Auth:** Supabase Auth (single-user app — keep auth minimal, magic link is fine, don't over-build)
- **LLM:** Anthropic Claude API — used for chat answers, summarization, and quiz generation
- **Embeddings:** OpenAI `text-embedding-3-small` (default) or Voyage AI — used for semantic search over document chunks
- **Hosting:** Railway (and/or Vercel for frontend)
- **Repo:** GitHub, connected to Railway for deploy

## Core Design Rules

1. **RAG grounding is mandatory.** Chat answers and quiz generation must be grounded in retrieved chunks from uploaded documents — never answer purely from the model's general knowledge without retrieval when documents exist for the topic. Always cite which document/chunk was used.
2. **Quizzes are self-graded — do not build auto-grading or rubric-based grading logic.** A quiz question always has: `question`, `correct_answer`, `explanation`. No `options`-specific grading branch, no correctness-checking code. The UI flow is: show question → user attempts (answer hidden) → reveal answer key → user marks themselves right/wrong → store `marked_correct: true/false`.
3. **Keep the schema stable.** Use the table names and columns defined in the project plan (`courses`, `documents`, `chunks`, `chat_sessions`, `chat_messages`, `quizzes`, `quiz_questions`, `quiz_attempts`) unless a change is discussed first.
4. **Single user for now.** Don't add multi-tenant complexity, roles, or permissions unless asked.
5. **Cite phase context.** When implementing a feature, name which roadmap phase it belongs to (Phase 0–5, per the project plan) in your summary of changes.

## What NOT to do

- Don't add a new vector DB, new LLM provider, or new hosting platform without discussing it first.
- Don't build quiz auto-grading/rubric scoring — this is explicitly out of scope for v1.
- Don't add multi-user auth/roles.
- Don't reach for heavy frameworks (no NestJS, no separate microservices) unless the app's scale genuinely requires it — this is a personal tool, keep it simple.

## Conventions

- TypeScript throughout (frontend and API routes).
- Environment variables for all API keys (Anthropic, embeddings provider, Supabase) — never hardcode.
- Keep API routes thin; put document-processing/chunking/retrieval logic in a `/lib` directory so it's testable and reusable.
- Prefer small, incremental commits per feature over large multi-feature commits.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
