-- ============================================================
-- CampusOS · Migration 4 — RAG search function
-- ============================================================

-- match_chunks: returns top-k document chunks by cosine similarity
-- to a query embedding vector, joined with document metadata.
--
-- Usage (from Supabase client or PostgREST RPC):
--   select * from match_chunks(
--     query_embedding := '[0.1, 0.2, ...]'::vector(768),
--     match_count     := 5,
--     min_similarity  := 0.5
--   );

create or replace function public.match_chunks(
  query_embedding vector(768),         -- change dimension if using a different model
  match_count     int     default 5,
  min_similarity  float   default 0.0  -- optional threshold to filter weak matches
)
returns table (
  id              uuid,
  document_id     uuid,
  chunk_index     int,
  content         text,
  page_ref        text,
  document_title  text,
  source_label    text,
  similarity      float
)
language plpgsql
stable                                  -- safe for read replicas & caching
security definer                        -- runs with table-owner privileges
set search_path = ''                    -- prevent search_path hijacking
as $$
begin
  return query
    select
      dc.id,
      dc.document_id,
      dc.chunk_index,
      dc.content,
      dc.page_ref,
      cd.title        as document_title,
      cd.source_label as source_label,
      1 - (dc.embedding <=> query_embedding) as similarity
    from public.document_chunks dc
    join public.campus_documents cd on cd.id = dc.document_id
    where cd.is_approved = true
      and 1 - (dc.embedding <=> query_embedding) >= min_similarity
    order by dc.embedding <=> query_embedding
    limit match_count;
end;
$$;

-- Grant execute to authenticated users (needed for RPC calls)
grant execute on function public.match_chunks(vector(768), int, float)
  to authenticated;
