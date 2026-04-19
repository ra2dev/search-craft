import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ id: string }> };

type QueryInput = {
  query: string;
  expected_document_ids: string[];
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
    const expected = item.expected_document_ids;
    if (!Array.isArray(expected) || expected.some((v) => typeof v !== "string" || !UUID_RE.test(v))) {
      return {
        rows: [],
        error: `Item ${i}: "expected_document_ids" must be an array of UUID strings`,
      };
    }
    let max_rank = 10;
    if (item.max_rank !== undefined) {
      const n = Number(item.max_rank);
      if (!Number.isInteger(n) || n < 1) {
        return { rows: [], error: `Item ${i}: "max_rank" must be an integer >= 1` };
      }
      max_rank = n;
    }
    rows.push({ query, expected_document_ids: expected as string[], max_rank });
  }
  return { rows };
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
    .select("id")
    .eq("id", validationSetId)
    .single();
  if (setError || !set) {
    return NextResponse.json({ error: "Validation set not found" }, { status: 404 });
  }

  const payload = rows.map((r) => ({
    validation_set_id: validationSetId,
    query: r.query,
    expected_document_ids: r.expected_document_ids,
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
    .select("id")
    .eq("id", validationSetId)
    .single();
  if (setError || !set) {
    return NextResponse.json({ error: "Validation set not found" }, { status: 404 });
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

  const payload = rows.map((r) => ({
    validation_set_id: validationSetId,
    query: r.query,
    expected_document_ids: r.expected_document_ids,
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
