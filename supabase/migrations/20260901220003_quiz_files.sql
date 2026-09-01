-- Stores the generated downloadable files for a quiz. A quiz has exactly one
-- quiz file and one solution file, so nullable columns on `quizzes` fit more
-- cleanly than a separate one-to-one table (avoids a join for what's a 1:1,
-- always-together pair, and both are just storage paths).
alter table quizzes
  add column quiz_file_url text,
  add column solution_file_url text;
