import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const supabase = createServerSupabase();

  const { data: set, error } = await supabase
    .from("validation_sets")
    .select("id, name, dataset_id, created_at")
    .eq("id", id)
    .single();

  if (error || !set) {
    return NextResponse.json({ error: error?.message ?? "Not found" }, { status: 404 });
  }

  const { data: queries, error: qError } = await supabase
    .from("validation_queries")
    .select("id, query, expected_document_ids, max_rank, created_at")
    .eq("validation_set_id", id)
    .order("created_at", { ascending: true });

  if (qError) {
    return NextResponse.json({ error: qError.message }, { status: 500 });
  }

  return NextResponse.json({ ...set, queries: queries ?? [] });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const supabase = createServerSupabase();

  const { error } = await supabase.from("validation_sets").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ id, deleted: true });
}
