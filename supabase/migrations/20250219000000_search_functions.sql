-- Hybrid search RPC functions — one per supported embedding dimension.
-- Each function performs a vector search on the matching embedding_<dim> column,
-- an FTS search on search_vector, and combines the two using Reciprocal Rank
-- Fusion (RRF) with constant k = 60.

create or replace function public.match_search_documents_384(
  p_search_dataset_id uuid,
  p_query text,
  p_query_embedding vector(384),
  p_k int default 10
)
returns table (
  id uuid,
  document_id uuid,
  content text,
  description text,
  vector_similarity double precision,
  fts_rank double precision,
  score double precision
)
language sql stable
as $$
  with vec as (
    select id, document_id, content, description,
           1 - (embedding_384 <=> p_query_embedding) as vector_similarity,
           row_number() over (order by embedding_384 <=> p_query_embedding) as rnk
    from public.search_documents
    where search_dataset_id = p_search_dataset_id
      and embedding_384 is not null
    order by embedding_384 <=> p_query_embedding
    limit greatest(p_k * 5, 50)
  ),
  fts as (
    select id, document_id, content, description,
           ts_rank(search_vector, websearch_to_tsquery('english', p_query)) as fts_rank,
           row_number() over (
             order by ts_rank(search_vector, websearch_to_tsquery('english', p_query)) desc
           ) as rnk
    from public.search_documents
    where search_dataset_id = p_search_dataset_id
      and length(coalesce(p_query, '')) > 0
      and search_vector @@ websearch_to_tsquery('english', p_query)
    limit greatest(p_k * 5, 50)
  ),
  combined as (
    select coalesce(v.id, f.id) as id,
           coalesce(v.document_id, f.document_id) as document_id,
           coalesce(v.content, f.content) as content,
           coalesce(v.description, f.description) as description,
           coalesce(v.vector_similarity, 0) as vector_similarity,
           coalesce(f.fts_rank, 0) as fts_rank,
           coalesce(1.0 / (60 + v.rnk), 0) + coalesce(1.0 / (60 + f.rnk), 0) as score
    from vec v
    full outer join fts f on v.id = f.id
  )
  select id, document_id, content, description, vector_similarity, fts_rank, score
  from combined
  order by score desc
  limit p_k;
$$;

create or replace function public.match_search_documents_768(
  p_search_dataset_id uuid,
  p_query text,
  p_query_embedding vector(768),
  p_k int default 10
)
returns table (
  id uuid,
  document_id uuid,
  content text,
  description text,
  vector_similarity double precision,
  fts_rank double precision,
  score double precision
)
language sql stable
as $$
  with vec as (
    select id, document_id, content, description,
           1 - (embedding_768 <=> p_query_embedding) as vector_similarity,
           row_number() over (order by embedding_768 <=> p_query_embedding) as rnk
    from public.search_documents
    where search_dataset_id = p_search_dataset_id
      and embedding_768 is not null
    order by embedding_768 <=> p_query_embedding
    limit greatest(p_k * 5, 50)
  ),
  fts as (
    select id, document_id, content, description,
           ts_rank(search_vector, websearch_to_tsquery('english', p_query)) as fts_rank,
           row_number() over (
             order by ts_rank(search_vector, websearch_to_tsquery('english', p_query)) desc
           ) as rnk
    from public.search_documents
    where search_dataset_id = p_search_dataset_id
      and length(coalesce(p_query, '')) > 0
      and search_vector @@ websearch_to_tsquery('english', p_query)
    limit greatest(p_k * 5, 50)
  ),
  combined as (
    select coalesce(v.id, f.id) as id,
           coalesce(v.document_id, f.document_id) as document_id,
           coalesce(v.content, f.content) as content,
           coalesce(v.description, f.description) as description,
           coalesce(v.vector_similarity, 0) as vector_similarity,
           coalesce(f.fts_rank, 0) as fts_rank,
           coalesce(1.0 / (60 + v.rnk), 0) + coalesce(1.0 / (60 + f.rnk), 0) as score
    from vec v
    full outer join fts f on v.id = f.id
  )
  select id, document_id, content, description, vector_similarity, fts_rank, score
  from combined
  order by score desc
  limit p_k;
$$;

create or replace function public.match_search_documents_1536(
  p_search_dataset_id uuid,
  p_query text,
  p_query_embedding vector(1536),
  p_k int default 10
)
returns table (
  id uuid,
  document_id uuid,
  content text,
  description text,
  vector_similarity double precision,
  fts_rank double precision,
  score double precision
)
language sql stable
as $$
  with vec as (
    select id, document_id, content, description,
           1 - (embedding_1536 <=> p_query_embedding) as vector_similarity,
           row_number() over (order by embedding_1536 <=> p_query_embedding) as rnk
    from public.search_documents
    where search_dataset_id = p_search_dataset_id
      and embedding_1536 is not null
    order by embedding_1536 <=> p_query_embedding
    limit greatest(p_k * 5, 50)
  ),
  fts as (
    select id, document_id, content, description,
           ts_rank(search_vector, websearch_to_tsquery('english', p_query)) as fts_rank,
           row_number() over (
             order by ts_rank(search_vector, websearch_to_tsquery('english', p_query)) desc
           ) as rnk
    from public.search_documents
    where search_dataset_id = p_search_dataset_id
      and length(coalesce(p_query, '')) > 0
      and search_vector @@ websearch_to_tsquery('english', p_query)
    limit greatest(p_k * 5, 50)
  ),
  combined as (
    select coalesce(v.id, f.id) as id,
           coalesce(v.document_id, f.document_id) as document_id,
           coalesce(v.content, f.content) as content,
           coalesce(v.description, f.description) as description,
           coalesce(v.vector_similarity, 0) as vector_similarity,
           coalesce(f.fts_rank, 0) as fts_rank,
           coalesce(1.0 / (60 + v.rnk), 0) + coalesce(1.0 / (60 + f.rnk), 0) as score
    from vec v
    full outer join fts f on v.id = f.id
  )
  select id, document_id, content, description, vector_similarity, fts_rank, score
  from combined
  order by score desc
  limit p_k;
$$;

create or replace function public.match_search_documents_3072(
  p_search_dataset_id uuid,
  p_query text,
  p_query_embedding halfvec(3072),
  p_k int default 10
)
returns table (
  id uuid,
  document_id uuid,
  content text,
  description text,
  vector_similarity double precision,
  fts_rank double precision,
  score double precision
)
language sql stable
as $$
  with vec as (
    select id, document_id, content, description,
           1 - (embedding_3072 <=> p_query_embedding) as vector_similarity,
           row_number() over (order by embedding_3072 <=> p_query_embedding) as rnk
    from public.search_documents
    where search_dataset_id = p_search_dataset_id
      and embedding_3072 is not null
    order by embedding_3072 <=> p_query_embedding
    limit greatest(p_k * 5, 50)
  ),
  fts as (
    select id, document_id, content, description,
           ts_rank(search_vector, websearch_to_tsquery('english', p_query)) as fts_rank,
           row_number() over (
             order by ts_rank(search_vector, websearch_to_tsquery('english', p_query)) desc
           ) as rnk
    from public.search_documents
    where search_dataset_id = p_search_dataset_id
      and length(coalesce(p_query, '')) > 0
      and search_vector @@ websearch_to_tsquery('english', p_query)
    limit greatest(p_k * 5, 50)
  ),
  combined as (
    select coalesce(v.id, f.id) as id,
           coalesce(v.document_id, f.document_id) as document_id,
           coalesce(v.content, f.content) as content,
           coalesce(v.description, f.description) as description,
           coalesce(v.vector_similarity, 0) as vector_similarity,
           coalesce(f.fts_rank, 0) as fts_rank,
           coalesce(1.0 / (60 + v.rnk), 0) + coalesce(1.0 / (60 + f.rnk), 0) as score
    from vec v
    full outer join fts f on v.id = f.id
  )
  select id, document_id, content, description, vector_similarity, fts_rank, score
  from combined
  order by score desc
  limit p_k;
$$;
