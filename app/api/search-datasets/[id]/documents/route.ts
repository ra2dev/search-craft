import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { id: searchDatasetId } = await context.params;
  const supabase = createServerSupabase();

  const { data, error, count } = await supabase
    .from("search_documents")
    .select("id, content, description, created_at", { count: "exact" })
    .eq("search_dataset_id", searchDatasetId)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    total: count ?? 0,
    documents: data ?? [],
  });
}
