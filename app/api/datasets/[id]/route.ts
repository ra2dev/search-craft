import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const supabase = createServerSupabase();

  // FK cascades handle documents, search_datasets, search_documents,
  // validation_sets, validation_queries, and validation_runs.
  const { error } = await supabase.from("datasets").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ id, deleted: true });
}
