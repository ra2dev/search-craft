alter table public.search_datasets
  add column if not exists rerank_enabled boolean not null default false,
  add column if not exists rerank_model text,
  add column if not exists rerank_candidate_count smallint not null default 50;

comment on column public.search_datasets.rerank_candidate_count is 'Hybrid retrieval pool size before optional LLM rerank (capped at 100 in app code).';
