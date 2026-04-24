import { NextResponse } from "next/server";
import { POSTGREST_MAX_ROWS } from "@/lib/supabase/postgrest-limits";
import { createServerSupabase } from "@/lib/supabase/server";

const EMBEDDING_DIMENSIONS = [384, 768, 1536, 3072] as const;

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { id: datasetId } = await context.params;
  const supabase = createServerSupabase();

  const { data, error } = await supabase
    .from("search_datasets")
    .select("id, name, description_prompt, description_model, embedding_model, embedding_dimension, status, created_at")
    .eq("dataset_id", datasetId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}

export async function POST(request: Request, context: RouteContext) {
  const { id: datasetId } = await context.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const o = body as Record<string, unknown>;
  const name = typeof o?.name === "string" ? o.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const description_prompt = typeof o.description_prompt === "string" ? o.description_prompt : null;
  const description_model = typeof o.description_model === "string" ? o.description_model : null;
  const embedding_model = typeof o.embedding_model === "string" ? o.embedding_model : null;
  const dim = o.embedding_dimension;
  const embedding_dimension = typeof dim === "number" && EMBEDDING_DIMENSIONS.includes(dim as (typeof EMBEDDING_DIMENSIONS)[number])
    ? (dim as (typeof EMBEDDING_DIMENSIONS)[number])
    : null;

  if (!embedding_model || !embedding_dimension) {
    return NextResponse.json(
      { error: "embedding_model and embedding_dimension (384|768|1536|3072) are required" },
      { status: 400 }
    );
  }

  const supabase = createServerSupabase();

  const { data: dataset, error: datasetError } = await supabase
    .from("datasets")
    .select("id")
    .eq("id", datasetId)
    .single();

  if (datasetError || !dataset?.id) {
    return NextResponse.json({ error: "Dataset not found" }, { status: 404 });
  }

  const { data: searchDataset, error: insertError } = await supabase
    .from("search_datasets")
    .insert({
      dataset_id: datasetId,
      name,
      description_prompt,
      description_model,
      embedding_model,
      embedding_dimension,
      status: "uploaded",
    })
    .select("id")
    .single();

  if (insertError || !searchDataset?.id) {
    return NextResponse.json(
      { error: insertError?.message ?? "Failed to create search dataset" },
      { status: 500 }
    );
  }

  const documents: { id: string; content: string }[] = [];
  for (let from = 0; ; from += POSTGREST_MAX_ROWS) {
    const to = from + POSTGREST_MAX_ROWS - 1;
    const { data: page, error: docsError } = await supabase
      .from("documents")
      .select("id, content")
      .eq("dataset_id", datasetId)
      .order("id", { ascending: true })
      .range(from, to);

    if (docsError) {
      return NextResponse.json({ error: docsError.message }, { status: 500 });
    }
    const batch = page ?? [];
    documents.push(...batch);
    if (batch.length < POSTGREST_MAX_ROWS) break;
  }

  if (documents.length > 0) {
    const searchDocuments = documents.map((d) => ({
      search_dataset_id: searchDataset.id,
      document_id: d.id,
      content: d.content,
    }));

    for (let i = 0; i < searchDocuments.length; i += POSTGREST_MAX_ROWS) {
      const chunk = searchDocuments.slice(i, i + POSTGREST_MAX_ROWS);
      const { error: seedError } = await supabase.from("search_documents").insert(chunk);
      if (seedError) {
        return NextResponse.json({ error: seedError.message }, { status: 500 });
      }
    }
  }

  return NextResponse.json({
    id: searchDataset.id,
    name,
    document_count: documents.length,
  });
}
