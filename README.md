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
components/  Shared React components
lib/         Document processing, chunking, retrieval, and Supabase client helpers
docs/        Project plan and other reference docs
```

## Deployment

Deploys to Railway and/or Vercel, connected to this GitHub repo. See
`docs/project-plan.md` for the roadmap and architecture.
