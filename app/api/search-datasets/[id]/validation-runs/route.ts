import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { id: searchDatasetId } = await context.params;
  const supabase = createServerSupabase();

  const { data, error } = await supabase
    .from("validation_runs")
    .select("id, run_at, metrics, validation_set_id, validation_sets(name)")
    .eq("search_dataset_id", searchDatasetId)
    .order("run_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  type Row = {
    id: string;
    run_at: string;
    metrics: Record<string, unknown> | null;
    validation_set_id: string;
    validation_sets: { name: string } | { name: string }[] | null;
  };

  const runs = (data as Row[] | null ?? []).map((row) => {
    const vs = row.validation_sets;
    const setName = Array.isArray(vs) ? vs[0]?.name : vs?.name;
    const m = (row.metrics ?? {}) as Record<string, unknown>;
    return {
      id: row.id,
      run_at: row.run_at,
      validation_set_id: row.validation_set_id,
      validation_set_name: setName ?? null,
      metrics: {
        total_queries: (m.total_queries as number | undefined) ?? null,
        pass_rate: (m.pass_rate as number | undefined) ?? null,
        recall_at_max_rank: (m.recall_at_max_rank as number | undefined) ?? null,
        mrr: (m.mrr as number | undefined) ?? null,
      },
    };
  });

  return NextResponse.json(runs);
}
