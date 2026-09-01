# MBA Study Assistant — Project Plan

## 1. Goal

A personal study tool (chatbot + web app) that helps you prepare for MBA coursework/exams by:
- Answering questions about uploaded material (notes, textbooks, case studies, slides)
- Summarizing uploaded content
- Generating practice quizzes from sample quizzes/exams you upload (matching style, difficulty, format)
- Tracking your progress over time (weak topics, quiz history, spaced repetition)

This is a **RAG (Retrieval-Augmented Generation) app**: you upload documents, the app indexes them, and an LLM answers/generates content grounded in that material — rather than generic answers.

---

## 2. Core Features

### MVP (build first)
1. **Document upload** — PDF, DOCX, PPTX, TXT (course notes, case studies, textbook chapters)
2. **Chat interface** — ask questions about uploaded material, get grounded answers with citations to source doc/page
3. **Summarization** — generate a summary of any uploaded doc or selected sections
4. **Quiz generation** — upload a sample quiz (format/style reference) + select source material → generate a new practice quiz matching that style
5. **Quiz taking (self-graded)** — quiz is generated with questions *and* an answer key/explanation up front. You attempt it, then reveal the solution and mark yourself right/wrong. No auto-grading logic needed for v1 — this works for any question format (MC, short answer, case-based, essay) since you're the one judging correctness.

### Phase 2 (once MVP works)
6. **Topic/course organization** — folders per course (Finance, Strategy, Ops, etc.)
7. **Progress tracking** — quiz history, self-reported accuracy by topic, identify weak areas (once auto-grading isn't needed, this is just logging what you marked yourself)
8. **Spaced repetition** — resurface questions you got wrong
9. **Flashcards** — auto-generate from documents
10. **Multi-doc synthesis** — "compare what these 3 case studies say about X"

### Phase 3 (nice to have)
11. Voice input/output for hands-free review
12. Export quizzes/summaries as PDF
13. Collaborative study (share a course folder with classmates)

---

## 3. Recommended Tech Stack

You already have **Supabase**, **Railway**, and **GitHub** — this stack uses all three with no new accounts needed.

| Layer | Tool | Why |
|---|---|---|
| Frontend | Next.js (React) + Tailwind | Fast to build chat UI, deploys easily, good with Vercel or Railway |
| Backend/API | Next.js API routes or a small Node/Python service on Railway | Handles LLM calls, quiz generation logic |
| Database | Supabase (Postgres) | Store documents metadata, quiz results, chat history |
| Vector store | **Supabase pgvector** extension | Store embeddings for RAG search — no separate vector DB needed |
| File storage | Supabase Storage | Store original uploaded PDFs/DOCX |
| Auth | Supabase Auth | Simple email/password or magic link (single user, so can even skip auth for v1) |
| LLM | Anthropic API (Claude) | Chat answers, summarization, quiz generation |
| Embeddings | OpenAI `text-embedding-3-small` or Voyage AI (Anthropic-recommended) | For semantic search over your documents |
| Hosting | Railway (backend) + Vercel or Railway (frontend) | You already have Railway set up |
| Repo | GitHub | Version control, CI/CD trigger for Railway |

**Why Supabase pgvector instead of Pinecone/Weaviate:** you already have Supabase running for ValorSoph, it keeps everything in one place, avoids managing a second database, and is more than enough for a personal document set (a few hundred to low-thousands of chunks).

---

## 4. Architecture (high level)

```
┌─────────────┐      ┌──────────────────┐      ┌─────────────────┐
│  Next.js UI │─────▶│  API layer        │─────▶│  Claude API      │
│ (chat, quiz,│      │  (Railway or      │      │  (chat, summary, │
│  upload)    │◀─────│  Next.js API)     │◀─────│   quiz gen)      │
└─────────────┘      └────────┬─────────┘      └─────────────────┘
                               │
                 ┌─────────────┼──────────────┐
                 ▼                             ▼
        ┌────────────────┐           ┌──────────────────┐
        │ Supabase Storage│           │ Supabase Postgres │
        │ (raw files)     │           │ + pgvector         │
        └────────────────┘           │ (chunks, embeddings,│
                                      │  quizzes, results)  │
                                      └──────────────────┘
```

**Document pipeline (upload → usable):**
1. User uploads file → stored in Supabase Storage
2. Backend extracts text (PDF/DOCX/PPTX parsing)
3. Text is chunked (~500-800 tokens per chunk, with overlap)
4. Each chunk gets an embedding → stored in Supabase (pgvector column)
5. Document marked "ready" for chat/quiz use

**Chat/Q&A flow:**
1. User asks a question
2. Question is embedded, top-k similar chunks retrieved from pgvector
3. Chunks + question sent to Claude as context
4. Claude answers, citing which document/section it used

**Quiz generation flow:**
1. User uploads a sample quiz (to capture format: multiple choice, case-based, essay, etc.)
2. User selects source material (a doc, chapter, or topic)
3. Claude is prompted with: sample quiz structure + relevant source chunks → generates N new questions **plus a full answer key/explanation for each**, in matching style
4. Output stored as a structured quiz object (question, correct answer, explanation) — no grading logic required
5. Rendered in-app: user attempts the quiz first (answers hidden), then reveals the key and self-marks each question right/wrong

---

## 5. Data Model (Supabase tables — draft)

- `courses` — id, name, description
- `documents` — id, course_id, title, file_url, type, uploaded_at, status
- `chunks` — id, document_id, content, embedding (vector), page_ref
- `chat_sessions` — id, course_id, created_at
- `chat_messages` — id, session_id, role, content, cited_chunk_ids, created_at
- `quizzes` — id, course_id, source_document_ids, style_reference_id, created_at
- `quiz_questions` — id, quiz_id, question, correct_answer, explanation (no `options`/grading fields needed for MC-specific logic — same schema works for any question type since answer is just reference text)
- `quiz_attempts` — id, quiz_id, self_marked_results (jsonb — e.g. `[{question_id, marked_correct: true/false}]`), completed_at

---

## 6. Build Roadmap

**Phase 0 — Setup (½ day)**
- New GitHub repo, Next.js scaffold, connect to Supabase project, connect Railway deploy

**Phase 1 — Document pipeline (2-3 days)**
- File upload UI + Supabase Storage integration
- Text extraction (PDF/DOCX/PPTX parsing library)
- Chunking + embedding + pgvector storage

**Phase 2 — Chat/Q&A (2-3 days)**
- Retrieval function (similarity search in pgvector)
- Claude API integration for grounded answers
- Chat UI with citations

**Phase 3 — Summarization (1 day)**
- Simple "summarize this document/section" endpoint + UI button

**Phase 4 — Quiz generation & taking (3-4 days)**
- Sample quiz upload + parsing to detect format
- Quiz generation prompt engineering
- Quiz-taking UI (attempt → reveal answer key) + self-marking + explanations

**Phase 5 — Polish (ongoing)**
- Progress tracking, course organization, spaced repetition

---

## 7. Key Decisions to Make Before Starting

- **Single user or multi-user?** If it's just you, skip auth complexity for v1 (or use Supabase magic link for simplicity/security since it'll be on the internet).
- **Which embedding model?** OpenAI is cheapest/easiest to start; Voyage AI is Anthropic's recommended partner and tunes well for retrieval quality.
- **Quiz format scope?** Resolved — v1 uses self-grading (quiz generated with answer key + explanations, you mark yourself after attempting). This means any question format works from day one (MC, case-based, essay) without needing LLM-based rubric grading. Auto-grading can be added later as an optional Phase 3 feature if you want it, but it's no longer a blocker.
- **Budget** — Claude API + embedding API calls are usage-based; for personal study use this should be low cost (a few dollars/month), but worth setting usage alerts.

---

## 8. Next Steps

1. Confirm the tech stack above (or swap pieces you'd rather use)
2. Set up the Supabase schema (tables above + enable pgvector extension)
3. Scaffold the Next.js repo and connect Railway deployment
4. Build Phase 1 (document pipeline) first — everything else depends on it
