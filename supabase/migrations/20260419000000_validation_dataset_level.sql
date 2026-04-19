-- Move validation_sets from search_dataset_id → dataset_id (many per dataset),
-- add per-query max_rank on validation_queries, and record which search_dataset
-- a validation_run evaluated.

-- validation_sets: add dataset_id, backfill from search_datasets, swap columns.
alter table public.validation_sets
  add column dataset_id uuid references public.datasets(id) on delete cascade;

update public.validation_sets vs
set dataset_id = sd.dataset_id
from public.search_datasets sd
where vs.search_dataset_id = sd.id;

alter table public.validation_sets
  alter column dataset_id set not null,
  add constraint validation_sets_dataset_id_name_key unique (dataset_id, name);

drop index if exists public.validation_sets_search_dataset_id_idx;
alter table public.validation_sets drop column search_dataset_id;
create index if not exists validation_sets_dataset_id_idx
  on public.validation_sets(dataset_id);

-- validation_queries: per-query rank threshold.
alter table public.validation_queries
  add column max_rank int not null default 10 check (max_rank >= 1);

comment on column public.validation_queries.max_rank is
  'Expected document(s) must appear within this rank in the search results (e.g. 1 = first, 10 = top 10).';

-- validation_runs: record which search config was evaluated.
alter table public.validation_runs
  add column search_dataset_id uuid references public.search_datasets(id) on delete cascade;

alter table public.validation_runs
  alter column search_dataset_id set not null;

create index if not exists validation_runs_search_dataset_id_idx
  on public.validation_runs(search_dataset_id);

comment on column public.validation_runs.metrics is
  'e.g. { "pass_rate": 0.82, "recall_at_max_rank": 0.9, "mrr": 0.78, "per_query": [...] }';
