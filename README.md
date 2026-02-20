# Search Optimizer

Platform to **build search** over your data (e.g. emojis, memes). Allow to build optiomal search and validate quality - easily switch models/datasets/search/etc.

**Building search**

- **Upload** – JSON array of rows → one dataset and many documents (content + metadata).
- **Search datasets** – From one dataset create multiple search configs (description prompt, description model, embedding model/dimension). Each config gets its own search_dataset and search_documents (content copy + LLM description + embedding in 384/768/1536/3072 dimensions).
- **Describe** – LLM (e.g. OpenAI) fills descriptions per row using the config prompt.
- **Vectorize** – Embed content + description and store in the chosen embedding column.
- **Search** – Hybrid (vector + full-text) over a search_dataset; returns ranked docs.

**Measuring quality**

- **Validation** – Upload query + expected doc IDs; run search and get recall@k / MRR.

**Stack:** Next.js, Supabase (Postgres + pgvector), OpenAI (or configurable) for describe/embed. All Supabase access from the server (API routes) with the service role.
