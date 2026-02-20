-- Datasets: raw upload only (one per uploaded JSON file, e.g. emoji list, meme list)
create table public.datasets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);
