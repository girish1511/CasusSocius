-- PostgREST can't express the pgvector <=> distance operator directly, so
-- retrieval goes through this RPC function instead of a raw table query.
create or replace function match_chunks(
  query_embedding vector(1536),
  match_document_ids uuid[],
  match_count int default 8
)
returns table (
  id uuid,
  document_id uuid,
  content text,
  page_ref text,
  similarity float
)
language sql stable
as $$
  select
    chunks.id,
    chunks.document_id,
    chunks.content,
    chunks.page_ref,
    1 - (chunks.embedding <=> query_embedding) as similarity
  from chunks
  where chunks.document_id = any(match_document_ids)
  order by chunks.embedding <=> query_embedding
  limit match_count;
$$;
