-- Validation runs: store results and metrics for each validation execution
create table public.validation_runs (
  id uuid primary key default gen_random_uuid(),
  validation_set_id uuid not null references public.validation_sets(id) on delete cascade,
  run_at timestamptz not null default now(),
  params jsonb default '{}',
  metrics jsonb not null default '{}',
  created_at timestamptz not null default now()
);

comment on column public.validation_runs.params is 'e.g. { "top_k": 10, "vector_weight": 0.7 }';
comment on column public.validation_runs.metrics is 'e.g. { "recall_at_5": 0.85, "recall_at_10": 0.92, "mrr": 0.78 }';
