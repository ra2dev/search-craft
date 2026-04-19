import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  HybridSearchError,
  loadSearchConfig,
  runHybridSearch,
} from "@/lib/search/hybrid-search";

type RouteContext = { params: Promise<{ id: string }> };

type PerQueryResult = {
  query_id: string;
  query: string;
  max_rank: number;
  expected_document_ids: string[];
  ranks: Array<number | null>;
  best_rank: number | null;
  passed: boolean;
};

type ValidationMetrics = {
  total_queries: number;
  pass_rate: number;
  recall_at_max_rank: number;
  mrr: number;
};

export async function POST(request: Request, context: RouteContext) {
  const { id: searchDatasetId } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const validationSetId = (body as { validation_set_id?: unknown })?.validation_set_id;
  if (typeof validationSetId !== "string" || validationSetId.length === 0) {
    return NextResponse.json({ error: "validation_set_id is required" }, { status: 400 });
  }

  const supabase = createServerSupabase();

  const { data: searchDataset, error: sdError } = await supabase
    .from("search_datasets")
    .select("id, dataset_id")
    .eq("id", searchDatasetId)
    .single();
  if (sdError || !searchDataset) {
    return NextResponse.json(
      { error: sdError?.message ?? "Search dataset not found" },
      { status: 404 }
    );
  }

  const { data: validationSet, error: vsError } = await supabase
    .from("validation_sets")
    .select("id, name, dataset_id")
    .eq("id", validationSetId)
    .single();
  if (vsError || !validationSet) {
    return NextResponse.json(
      { error: vsError?.message ?? "Validation set not found" },
      { status: 404 }
    );
  }

  if (validationSet.dataset_id !== searchDataset.dataset_id) {
    return NextResponse.json(
      {
        error:
          "Validation set belongs to a different dataset than this search config. Pick a set from the same parent dataset.",
      },
      { status: 400 }
    );
  }

  const { data: queries, error: qError } = await supabase
    .from("validation_queries")
    .select("id, query, expected_document_ids, max_rank")
    .eq("validation_set_id", validationSetId)
    .order("created_at", { ascending: true });
  if (qError) {
    return NextResponse.json({ error: qError.message }, { status: 500 });
  }
  const queryRows = queries ?? [];

  if (queryRows.length === 0) {
    return NextResponse.json(
      { error: "Validation set has no queries. Add queries first." },
      { status: 400 }
    );
  }

  let config;
  try {
    config = await loadSearchConfig(searchDatasetId);
  } catch (err) {
    if (err instanceof HybridSearchError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }

  const perQuery: PerQueryResult[] = [];
  let passedCount = 0;
  let recallSum = 0;
  let mrrSum = 0;

  for (const q of queryRows) {
    const maxRank = (q.max_rank ?? 10) as number;
    const expected = (q.expected_document_ids ?? []) as string[];
    // Use k = max(max_rank, 10) so aggregate recall@10 / MRR@10 stay comparable.
    const k = Math.max(maxRank, 10);

    let results;
    try {
      results = await runHybridSearch({ config, query: q.query as string, k });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Search failed";
      return NextResponse.json({ error: `Query "${q.query}": ${message}` }, { status: 500 });
    }

    // Rank by document_id (1-indexed). If an expected doc maps to multiple
    // search_documents (shouldn't normally happen), use the first occurrence.
    const rankByDocId = new Map<string, number>();
    results.forEach((r, i) => {
      if (!rankByDocId.has(r.document_id)) {
        rankByDocId.set(r.document_id, i + 1);
      }
    });

    const ranks: Array<number | null> = expected.map((docId) =>
      rankByDocId.has(docId) ? (rankByDocId.get(docId) as number) : null
    );

    const withinThreshold = ranks.filter((r) => r !== null && r <= maxRank).length;
    const passed = expected.length > 0 && ranks.every((r) => r !== null && r <= maxRank);
    const recallForQuery = expected.length === 0 ? 1 : withinThreshold / expected.length;
    const bestRank =
      ranks.reduce<number | null>(
        (best, r) => (r !== null && (best === null || r < best) ? r : best),
        null
      ) ?? null;
    const mrrForQuery = bestRank !== null ? 1 / bestRank : 0;

    if (passed) passedCount += 1;
    recallSum += recallForQuery;
    mrrSum += mrrForQuery;

    perQuery.push({
      query_id: q.id as string,
      query: q.query as string,
      max_rank: maxRank,
      expected_document_ids: expected,
      ranks,
      best_rank: bestRank,
      passed,
    });
  }

  const total = queryRows.length;
  const metrics: ValidationMetrics = {
    total_queries: total,
    pass_rate: total === 0 ? 0 : passedCount / total,
    recall_at_max_rank: total === 0 ? 0 : recallSum / total,
    mrr: total === 0 ? 0 : mrrSum / total,
  };

  const { data: run, error: runError } = await supabase
    .from("validation_runs")
    .insert({
      validation_set_id: validationSetId,
      search_dataset_id: searchDatasetId,
      params: {},
      metrics: { ...metrics, per_query: perQuery },
    })
    .select("id, run_at")
    .single();
  if (runError) {
    return NextResponse.json({ error: runError.message }, { status: 500 });
  }

  return NextResponse.json({
    run_id: run?.id,
    run_at: run?.run_at,
    metrics,
    per_query: perQuery,
  });
}
