import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ id: string }> };

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export async function GET(request: Request, context: RouteContext) {
  const { id: datasetId } = await context.params;
  const url = new URL(request.url);
  const limitParam = Number(url.searchParams.get("limit"));
  const limit =
    Number.isFinite(limitParam) && limitParam > 0
      ? Math.min(Math.floor(limitParam), MAX_LIMIT)
      : DEFAULT_LIMIT;

  const supabase = createServerSupabase();

  const { data, error, count } = await supabase
    .from("documents")
    .select("id, content, metadata, created_at", { count: "exact" })
    .eq("dataset_id", datasetId)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    total: count ?? 0,
    documents: data ?? [],
  });
}
