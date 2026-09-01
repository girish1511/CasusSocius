-- RLS for MBA Study Assistant tables.
--
-- Per the user's decision, this is a fully public, no-login app: no
-- Supabase Auth, no login screens, no auth.uid()/auth.role() checks. RLS is
-- enabled on every table as a placeholder that documents intent, but each
-- policy is open to both `anon` and `authenticated` so nothing changes
-- behaviorally today — every table is fully readable/writable via the
-- exposed anon key, same as if RLS were off.
--
-- If this URL/anon key is ever discovered by unwanted traffic, tighten
-- these policies then (e.g. gate on a shared secret header checked via a
-- Postgres function, or restrict at the network/IP level) rather than
-- introducing user auth.

alter table courses enable row level security;
alter table documents enable row level security;
alter table chunks enable row level security;
alter table chat_sessions enable row level security;
alter table chat_messages enable row level security;
alter table quizzes enable row level security;
alter table quiz_questions enable row level security;
alter table quiz_attempts enable row level security;

create policy "public full access" on courses
  for all
  to anon, authenticated
  using (true)
  with check (true);

create policy "public full access" on documents
  for all
  to anon, authenticated
  using (true)
  with check (true);

create policy "public full access" on chunks
  for all
  to anon, authenticated
  using (true)
  with check (true);

create policy "public full access" on chat_sessions
  for all
  to anon, authenticated
  using (true)
  with check (true);

create policy "public full access" on chat_messages
  for all
  to anon, authenticated
  using (true)
  with check (true);

create policy "public full access" on quizzes
  for all
  to anon, authenticated
  using (true)
  with check (true);

create policy "public full access" on quiz_questions
  for all
  to anon, authenticated
  using (true)
  with check (true);

create policy "public full access" on quiz_attempts
  for all
  to anon, authenticated
  using (true)
  with check (true);
