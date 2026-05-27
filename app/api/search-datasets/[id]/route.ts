import { NextResponse } from "next/server";
import { normalizeRerankCandidateCount } from "@/lib/llm/rerank";
import { createServerSupabase } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ id: string }> };

const EMBEDDING_COLUMNS: Record<number, string> = {
  384: "embedding_384",
  768: "embedding_768",
  1536: "embedding_1536",
  3072: "embedding_3072",
};

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const supabase = createServerSupabase();

  const { data: searchDataset, error } = await supabase
    .from("search_datasets")
    .select(
      "id, dataset_id, name, description_prompt, description_model, embedding_model, embedding_dimension, rerank_enabled, rerank_model, rerank_candidate_count, status, created_at"
    )
    .eq("id", id)
    .single();

  if (error || !searchDataset) {
    return NextResponse.json({ error: error?.message ?? "Not found" }, { status: 404 });
  }

  const embeddingColumn = searchDataset.embedding_dimension
    ? EMBEDDING_COLUMNS[searchDataset.embedding_dimension]
    : null;

  const [totalRes, describedRes, vectorizedRes] = await Promise.all([
    supabase
      .from("search_documents")
      .select("id", { count: "exact", head: true })
      .eq("search_dataset_id", id),
    supabase
      .from("search_documents")
      .select("id", { count: "exact", head: true })
      .eq("search_dataset_id", id)
      .not("description", "is", null),
    embeddingColumn
      ? supabase
          .from("search_documents")
          .select("id", { count: "exact", head: true })
          .eq("search_dataset_id", id)
          .not(embeddingColumn, "is", null)
      : Promise.resolve({ count: 0 }),
  ]);

  return NextResponse.json({
    ...searchDataset,
    document_count: totalRes.count ?? 0,
    described_count: describedRes.count ?? 0,
    vectorized_count: vectorizedRes.count ?? 0,
  });
}

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const o = body as Record<string, unknown>;
  const update: Record<string, unknown> = {};

  if ("rerank_enabled" in o) {
    update.rerank_enabled = o.rerank_enabled === true;
  }
  if ("rerank_model" in o) {
    const model = typeof o.rerank_model === "string" ? o.rerank_model.trim() : "";
    update.rerank_model = model || null;
  }
  if ("rerank_candidate_count" in o) {
    update.rerank_candidate_count = normalizeRerankCandidateCount(o.rerank_candidate_count);
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json(
      { error: "No rerank fields to update (rerank_enabled, rerank_model, rerank_candidate_count)" },
      { status: 400 }
    );
  }

  const supabase = createServerSupabase();

  if (update.rerank_enabled === true) {
    const { data: current } = await supabase
      .from("search_datasets")
      .select("rerank_model")
      .eq("id", id)
      .single();
    const model =
      (update.rerank_model as string | null) ?? current?.rerank_model ?? null;
    if (!model) {
      return NextResponse.json(
        { error: "rerank_model is required when rerank is enabled" },
        { status: 400 }
      );
    }
    if (!("rerank_model" in update)) {
      update.rerank_model = model;
    }
  }

  if (update.rerank_enabled === false) {
    update.rerank_model = null;
  }

  const { data, error } = await supabase
    .from("search_datasets")
    .update(update)
    .eq("id", id)
    .select(
      "id, rerank_enabled, rerank_model, rerank_candidate_count"
    )
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Not found" }, { status: 404 });
  }

  return NextResponse.json(data);
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const supabase = createServerSupabase();

  // FK cascades handle search_documents, validation_sets, validation_queries,
  // and validation_runs tied to this search dataset.
  const { error } = await supabase.from("search_datasets").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ id, deleted: true });
}
