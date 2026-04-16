import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const supabase = createServerSupabase();

  const { data: searchDataset, error } = await supabase
    .from("search_datasets")
    .select(
      "id, dataset_id, name, description_prompt, description_model, embedding_model, embedding_dimension, status, created_at"
    )
    .eq("id", id)
    .single();

  if (error || !searchDataset) {
    return NextResponse.json({ error: error?.message ?? "Not found" }, { status: 404 });
  }

  const [{ count: totalCount }, { count: describedCount }] = await Promise.all([
    supabase
      .from("search_documents")
      .select("id", { count: "exact", head: true })
      .eq("search_dataset_id", id),
    supabase
      .from("search_documents")
      .select("id", { count: "exact", head: true })
      .eq("search_dataset_id", id)
      .not("description", "is", null),
  ]);

  return NextResponse.json({
    ...searchDataset,
    document_count: totalCount ?? 0,
    described_count: describedCount ?? 0,
  });
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
