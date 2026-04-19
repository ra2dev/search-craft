import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { id: datasetId } = await context.params;
  const supabase = createServerSupabase();

  const { data: sets, error } = await supabase
    .from("validation_sets")
    .select("id, name, created_at")
    .eq("dataset_id", datasetId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const setIds = (sets ?? []).map((s) => s.id);

  const counts = new Map<string, number>();
  if (setIds.length > 0) {
    const { data: queries, error: qError } = await supabase
      .from("validation_queries")
      .select("validation_set_id")
      .in("validation_set_id", setIds);
    if (qError) {
      return NextResponse.json({ error: qError.message }, { status: 500 });
    }
    for (const row of queries ?? []) {
      const sid = row.validation_set_id as string;
      counts.set(sid, (counts.get(sid) ?? 0) + 1);
    }
  }

  const result = (sets ?? []).map((s) => ({
    ...s,
    query_count: counts.get(s.id) ?? 0,
  }));

  return NextResponse.json(result);
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

  const supabase = createServerSupabase();

  const { data: dataset, error: datasetError } = await supabase
    .from("datasets")
    .select("id")
    .eq("id", datasetId)
    .single();

  if (datasetError || !dataset?.id) {
    return NextResponse.json({ error: "Dataset not found" }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("validation_sets")
    .insert({ dataset_id: datasetId, name })
    .select("id, name, created_at")
    .single();

  if (error) {
    // Postgres unique_violation.
    if (error.code === "23505") {
      return NextResponse.json(
        { error: `A validation set named "${name}" already exists for this dataset.` },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ...data, query_count: 0 }, { status: 201 });
}
