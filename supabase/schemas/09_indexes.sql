-- Documents: dataset lookup
create index documents_dataset_id_idx on public.documents(dataset_id);

-- Search datasets: dataset lookup
create index search_datasets_dataset_id_idx on public.search_datasets(dataset_id);

-- Search documents: FTS, vector (one index per dimension), and lookups
create index search_documents_search_vector_idx on public.search_documents using gin(search_vector);
create index search_documents_embedding_384_idx on public.search_documents using hnsw (embedding_384 vector_cosine_ops) with (m = 16, ef_construction = 64);
create index search_documents_embedding_768_idx on public.search_documents using hnsw (embedding_768 vector_cosine_ops) with (m = 16, ef_construction = 64);
create index search_documents_embedding_1536_idx on public.search_documents using hnsw (embedding_1536 vector_cosine_ops) with (m = 16, ef_construction = 64);
create index search_documents_embedding_3072_idx on public.search_documents using hnsw (embedding_3072 halfvec_cosine_ops) with (m = 16, ef_construction = 64);
create index search_documents_search_dataset_id_idx on public.search_documents(search_dataset_id);
create index search_documents_document_id_idx on public.search_documents(document_id);

-- Validation
create index validation_sets_dataset_id_idx on public.validation_sets(dataset_id);
create index validation_queries_validation_set_id_idx on public.validation_queries(validation_set_id);
create index validation_runs_validation_set_id_idx on public.validation_runs(validation_set_id);
create index validation_runs_search_dataset_id_idx on public.validation_runs(search_dataset_id);
