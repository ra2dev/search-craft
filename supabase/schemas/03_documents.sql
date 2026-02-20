-- Documents: one row per item in a dataset (raw content only; no description/embedding here)
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  dataset_id uuid not null references public.datasets(id) on delete cascade,
  content text not null,
  metadata jsonb default '{}',
  created_at timestamptz not null default now()
);
