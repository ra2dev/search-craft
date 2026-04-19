import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ id: string }> };

type QueryInput = {
  query: string;
  expected_document_ids?: string[];
  expected_contents?: string[];
  max_rank?: number;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseQueries(body: unknown): { rows: QueryInput[]; error?: string } {
  if (!Array.isArray(body)) {
    return { rows: [], error: "Body must be an array of queries" };
  }
  const rows: QueryInput[] = [];
  for (let i = 0; i < body.length; i++) {
    const item = body[i] as Record<string, unknown> | null;
    if (!item || typeof item !== "object") {
      return { rows: [], error: `Item ${i}: must be an object` };
    }
    const query = typeof item.query === "string" ? item.query.trim() : "";
    if (!query) {
      return { rows: [], error: `Item ${i}: "query" is required` };
    }

    const hasIds = item.expected_document_ids !== undefined;
    const hasContents = item.expected_contents !== undefined;
    if (!hasIds && !hasContents) {
      return {
        rows: [],
        error: `Item ${i}: provide "expected_document_ids" (UUIDs) or "expected_contents" (content strings)`,
      };
    }

    let expected_document_ids: string[] | undefined;
    if (hasIds) {
      const v = item.expected_document_ids;
      if (
        !Array.isArray(v) ||
        v.some((x) => typeof x !== "string" || !UUID_RE.test(x))
      ) {
        return {
          rows: [],
          error: `Item ${i}: "expected_document_ids" must be an array of UUID strings`,
        };
      }
      expected_document_ids = v as string[];
    }

    let expected_contents: string[] | undefined;
    if (hasContents) {
      const v = item.expected_contents;
      if (!Array.isArray(v) || v.some((x) => typeof x !== "string" || !x.trim())) {
        return {
          rows: [],
          error: `Item ${i}: "expected_contents" must be an array of non-empty strings`,
        };
      }
      expected_contents = (v as string[]).map((s) => s.trim());
    }

    let max_rank = 10;
    if (item.max_rank !== undefined) {
      const n = Number(item.max_rank);
      if (!Number.isInteger(n) || n < 1) {
        return { rows: [], error: `Item ${i}: "max_rank" must be an integer >= 1` };
      }
      max_rank = n;
    }
    rows.push({ query, expected_document_ids, expected_contents, max_rank });
  }
  return { rows };
}

async function resolveContents(
  supabase: ReturnType<typeof createServerSupabase>,
  datasetId: string,
  rows: QueryInput[]
): Promise<{ resolved: { ids: string[] }[]; error?: string }> {
  const allContents = new Set<string>();
  for (const r of rows) {
    if (r.expected_contents) {
      for (const c of r.expected_contents) allContents.add(c);
    }
  }

  let contentMap = new Map<string, string>();
  if (allContents.size > 0) {
    const { data, error } = await supabase
      .from("documents")
      .select("id, content")
      .eq("dataset_id", datasetId)
      .in("content", Array.from(allContents));
    if (error) {
      return { resolved: [], error: error.message };
    }
    contentMap = new Map(
      (data ?? []).map((d: { id: string; content: string }) => [d.content, d.id])
    );
  }

  const resolved: { ids: string[] }[] = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const ids = new Set<string>();
    if (r.expected_document_ids) {
      for (const id of r.expected_document_ids) ids.add(id);
    }
    if (r.expected_contents) {
      const missing: string[] = [];
      for (const c of r.expected_contents) {
        const id = contentMap.get(c);
        if (!id) missing.push(c);
        else ids.add(id);
      }
      if (missing.length > 0) {
        return {
          resolved: [],
          error: `Item ${i}: no documents found in dataset for content: ${missing
            .map((m) => JSON.stringify(m))
            .join(", ")}`,
        };
      }
    }
    resolved.push({ ids: Array.from(ids) });
  }
  return { resolved };
}

export async function POST(request: Request, context: RouteContext) {
  const { id: validationSetId } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { rows, error: parseError } = parseQueries(body);
  if (parseError) {
    return NextResponse.json({ error: parseError }, { status: 400 });
  }
  if (rows.length === 0) {
    return NextResponse.json({ inserted_count: 0, queries: [] });
  }

  const supabase = createServerSupabase();

  const { data: set, error: setError } = await supabase
    .from("validation_sets")
    .select("id, dataset_id")
    .eq("id", validationSetId)
    .single();
  if (setError || !set) {
    return NextResponse.json({ error: "Validation set not found" }, { status: 404 });
  }

  const { resolved, error: resolveError } = await resolveContents(
    supabase,
    set.dataset_id,
    rows
  );
  if (resolveError) {
    return NextResponse.json({ error: resolveError }, { status: 400 });
  }

  const payload = rows.map((r, i) => ({
    validation_set_id: validationSetId,
    query: r.query,
    expected_document_ids: resolved[i].ids,
    max_rank: r.max_rank ?? 10,
  }));

  const { data, error } = await supabase
    .from("validation_queries")
    .insert(payload)
    .select("id, query, expected_document_ids, max_rank, created_at");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(
    { inserted_count: data?.length ?? 0, queries: data ?? [] },
    { status: 201 }
  );
}

export async function PUT(request: Request, context: RouteContext) {
  const { id: validationSetId } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { rows, error: parseError } = parseQueries(body);
  if (parseError) {
    return NextResponse.json({ error: parseError }, { status: 400 });
  }

  const supabase = createServerSupabase();

  const { data: set, error: setError } = await supabase
    .from("validation_sets")
    .select("id, dataset_id")
    .eq("id", validationSetId)
    .single();
  if (setError || !set) {
    return NextResponse.json({ error: "Validation set not found" }, { status: 404 });
  }

  const { resolved, error: resolveError } = await resolveContents(
    supabase,
    set.dataset_id,
    rows
  );
  if (resolveError) {
    return NextResponse.json({ error: resolveError }, { status: 400 });
  }

  const { error: delError } = await supabase
    .from("validation_queries")
    .delete()
    .eq("validation_set_id", validationSetId);
  if (delError) {
    return NextResponse.json({ error: delError.message }, { status: 500 });
  }

  if (rows.length === 0) {
    return NextResponse.json({ inserted_count: 0, queries: [] });
  }

  const payload = rows.map((r, i) => ({
    validation_set_id: validationSetId,
    query: r.query,
    expected_document_ids: resolved[i].ids,
    max_rank: r.max_rank ?? 10,
  }));

  const { data, error } = await supabase
    .from("validation_queries")
    .insert(payload)
    .select("id, query, expected_document_ids, max_rank, created_at");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ inserted_count: data?.length ?? 0, queries: data ?? [] });
}
