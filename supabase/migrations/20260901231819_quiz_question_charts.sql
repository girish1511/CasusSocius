-- Optional chart support for quiz questions. Both columns are additive and
-- nullable — most questions have neither. chart_spec holds the constrained
-- JSON the model produces (validated in application code before storage);
-- chart_image_url is the rendered PNG's storage URL, generated once at quiz
-- creation and reused in both quiz.pdf and solution.pdf.
alter table quiz_questions
  add column chart_spec jsonb,
  add column chart_image_url text;
