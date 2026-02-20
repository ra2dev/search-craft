-- RLS: enable on all tables (tighten policies when you add auth)
alter table public.datasets enable row level security;
alter table public.documents enable row level security;
alter table public.search_datasets enable row level security;
alter table public.search_documents enable row level security;
alter table public.validation_sets enable row level security;
alter table public.validation_queries enable row level security;
alter table public.validation_runs enable row level security;

create policy "Allow all on datasets" on public.datasets for all using (true) with check (true);
create policy "Allow all on documents" on public.documents for all using (true) with check (true);
create policy "Allow all on search_datasets" on public.search_datasets for all using (true) with check (true);
create policy "Allow all on search_documents" on public.search_documents for all using (true) with check (true);
create policy "Allow all on validation_sets" on public.validation_sets for all using (true) with check (true);
create policy "Allow all on validation_queries" on public.validation_queries for all using (true) with check (true);
create policy "Allow all on validation_runs" on public.validation_runs for all using (true) with check (true);
