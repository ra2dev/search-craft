import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

const EMBEDDING_COLUMNS: Record<number, string> = {
  384: "embedding_384",
  768: "embedding_768",
  1536: "embedding_1536",
  3072: "embedding_3072",
};

type LatestValidation = {
  validation_set_id: string;
  validation_set_name: string;
  run_at: string;
  mrr: number;
  pass_rate: number;
  recall_at_max_rank: number;
};

type SearchConfigRow = {
  id: string;
  name: string;
  dataset_id: string;
  dataset_name: string;
  status: string;
  embedding_dimension: number | null;
  document_count: number;
  vectorized_count: number;
  latest_validation: LatestValidation | null;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const datasetId = searchParams.get("dataset_id");
  const validationSetId = searchParams.get("validation_set_id");
  const includePending = searchParams.get("include_pending") === "true";

  const supabase = createServerSupabase();

  let configsQuery = supabase
    .from("search_datasets")
    .select(
      "id, name, dataset_id, status, embedding_dimension, datasets!inner(name)"
    )
    .order("name", { ascending: true });

  if (datasetId) {
    configsQuery = configsQuery.eq("dataset_id", datasetId);
  }
  if (!includePending) {
    configsQuery = configsQuery.eq("status", "vectorized");
  }

  const { data: rawConfigs, error: configsError } = await configsQuery;
  if (configsError) {
    return NextResponse.json({ error: configsError.message }, { status: 500 });
  }

  type RawRow = {
    id: string;
    name: string;
    dataset_id: string;
    status: string;
    embedding_dimension: number | null;
    datasets: { name: string } | { name: string }[] | null;
  };

  const configs = (rawConfigs as RawRow[] | null) ?? [];
  if (configs.length === 0) {
    return NextResponse.json([]);
  }

  const configIds = configs.map((c) => c.id);

  const docCounts = new Map<string, number>();
  const { data: docRows, error: docError } = await supabase
    .from("search_documents")
    .select("search_dataset_id")
    .in("search_dataset_id", configIds);
  if (docError) {
    return NextResponse.json({ error: docError.message }, { status: 500 });
  }
  for (const row of docRows ?? []) {
    const sid = row.search_dataset_id as string;
    docCounts.set(sid, (docCounts.get(sid) ?? 0) + 1);
  }

  const vectorizedCounts = new Map<string, number>();
  const byDimension = new Map<number, string[]>();
  for (const c of configs) {
    if (!c.embedding_dimension) continue;
    const list = byDimension.get(c.embedding_dimension) ?? [];
    list.push(c.id);
    byDimension.set(c.embedding_dimension, list);
  }
  for (const [dim, ids] of byDimension) {
    const col = EMBEDDING_COLUMNS[dim];
    if (!col) continue;
    const { data: vecRows, error: vecError } = await supabase
      .from("search_documents")
      .select("search_dataset_id")
      .in("search_dataset_id", ids)
      .not(col, "is", null);
    if (vecError) {
      return NextResponse.json({ error: vecError.message }, { status: 500 });
    }
    for (const row of vecRows ?? []) {
      const sid = row.search_dataset_id as string;
      vectorizedCounts.set(sid, (vectorizedCounts.get(sid) ?? 0) + 1);
    }
  }

  let runsQuery = supabase
    .from("validation_runs")
    .select(
      "search_dataset_id, validation_set_id, run_at, metrics, validation_sets(name)"
    )
    .in("search_dataset_id", configIds)
    .order("run_at", { ascending: false });

  if (validationSetId) {
    runsQuery = runsQuery.eq("validation_set_id", validationSetId);
  }

  const { data: runsRaw, error: runsError } = await runsQuery;
  if (runsError) {
    return NextResponse.json({ error: runsError.message }, { status: 500 });
  }

  type RunRow = {
    search_dataset_id: string;
    validation_set_id: string;
    run_at: string;
    metrics: Record<string, unknown> | null;
    validation_sets: { name: string } | { name: string }[] | null;
  };

  const latestByConfig = new Map<string, LatestValidation>();
  for (const row of (runsRaw as RunRow[] | null) ?? []) {
    if (latestByConfig.has(row.search_dataset_id)) continue;
    const vs = row.validation_sets;
    const setName = Array.isArray(vs) ? vs[0]?.name : vs?.name;
    const m = row.metrics ?? {};
    const mrr = m.mrr as number | undefined;
    const passRate = m.pass_rate as number | undefined;
    const recall = m.recall_at_max_rank as number | undefined;
    if (
      typeof mrr !== "number" ||
      typeof passRate !== "number" ||
      typeof recall !== "number" ||
      !setName
    ) {
      continue;
    }
    latestByConfig.set(row.search_dataset_id, {
      validation_set_id: row.validation_set_id,
      validation_set_name: setName,
      run_at: row.run_at,
      mrr,
      pass_rate: passRate,
      recall_at_max_rank: recall,
    });
  }

  const rows: SearchConfigRow[] = [];
  for (const c of configs) {
    const ds = c.datasets;
    const datasetName = Array.isArray(ds) ? ds[0]?.name : ds?.name;
    if (!datasetName) continue;

    const documentCount = docCounts.get(c.id) ?? 0;
    const vectorizedCount = vectorizedCounts.get(c.id) ?? 0;

    if (!includePending && vectorizedCount === 0) continue;

    rows.push({
      id: c.id,
      name: c.name,
      dataset_id: c.dataset_id,
      dataset_name: datasetName,
      status: c.status,
      embedding_dimension: c.embedding_dimension,
      document_count: documentCount,
      vectorized_count: vectorizedCount,
      latest_validation: latestByConfig.get(c.id) ?? null,
    });
  }

  rows.sort((a, b) => {
    const mrrA = a.latest_validation?.mrr ?? null;
    const mrrB = b.latest_validation?.mrr ?? null;
    if (mrrA != null && mrrB != null && mrrB !== mrrA) return mrrB - mrrA;
    if (mrrA != null && mrrB == null) return -1;
    if (mrrA == null && mrrB != null) return 1;
    return a.name.localeCompare(b.name);
  });

  return NextResponse.json(rows);
}
