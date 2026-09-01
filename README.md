# MBA Study Assistant

A personal RAG (retrieval-augmented generation) web app for studying MBA
coursework: chat with uploaded course material, generate summaries, and
generate self-graded practice quizzes from sample quizzes. Single-user app.

Full spec: [docs/project-plan.md](docs/project-plan.md). Repo conventions and
tech-stack constraints: [CLAUDE.md](CLAUDE.md).

## Tech stack

- Next.js (App Router) + React + Tailwind
- Next.js API routes for backend logic
- Supabase Postgres (+ `pgvector` for embeddings) and Supabase Storage
- Supabase Auth (magic link)
- Anthropic Claude API for chat/summarization/quiz generation
- OpenAI `text-embedding-3-small` for embeddings

## Local setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Copy the example file and fill in your keys:

```bash
cp .env.example .env.local
```

| Variable | Where to get it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase project → Settings → API (anon/public key) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase project → Settings → API (service_role key — server-only, never expose to the client) |
| `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com) |
| `OPENAI_API_KEY` | [platform.openai.com](https://platform.openai.com) (used for embeddings only) |

### 3. Set up Supabase

- Create a Supabase project (or reuse an existing one).
- Enable the `pgvector` extension (Database → Extensions → `vector`).
- Create the tables described in `docs/project-plan.md` section 5
  (`courses`, `documents`, `chunks`, `chat_sessions`, `chat_messages`,
  `quizzes`, `quiz_questions`, `quiz_attempts`).
- Enable magic-link email auth (Authentication → Providers → Email).

### 4. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project structure

```
app/         Next.js App Router pages and API routes
  documents/           Document upload/status UI
  api/documents/       Upload + status API routes (thin, delegate to /lib)
components/  Shared React components (DocumentManager, etc.)
lib/         Document processing, chunking, retrieval, and Supabase client helpers
  extraction/          PDF/DOCX/PPTX/TXT text extraction, per file type
  chunking/            Splits extracted text into ~500-800 token chunks
  embeddings/          OpenAI text-embedding-3-small wrapper
  documents/           Pipeline orchestration (extract -> chunk -> embed -> store)
  supabase/            Browser/server/service Supabase clients
supabase/migrations/  SQL migrations (schema, RLS, storage bucket)
docs/        Project plan and other reference docs
```

## Document pipeline (Phase 1)

Uploading a file at `/documents`:
1. Validates type (PDF/DOCX/PPTX/TXT) and size, uploads the raw file to the
   `documents` Supabase Storage bucket, and inserts a `documents` row with
   `status: 'processing'`.
2. Kicks off `processDocument` (`lib/documents/pipeline.ts`) in the
   background: extracts text per file type, chunks it (~500-800 tokens with
   overlap), embeds each chunk via OpenAI, and inserts rows into `chunks`.
3. Sets `status: 'ready'` on success, or `status: 'error'` (with the reason
   logged server-side) if any step fails.

The UI polls `/api/documents/[id]` every couple seconds while a document is
`processing` and shows the final status.

## Deployment

Deploys to Railway and/or Vercel, connected to this GitHub repo. See
`docs/project-plan.md` for the roadmap and architecture.
