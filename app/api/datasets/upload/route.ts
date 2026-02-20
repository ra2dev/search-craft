import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

const uploadBodySchema = {
  name: "" as string,
  rows: [] as Array<{ content: string; metadata?: Record<string, unknown> }>,
};

function parseBody(body: unknown): { name: string; rows: typeof uploadBodySchema.rows } | null {
  if (body == null || typeof body !== "object") return null;
  const o = body as Record<string, unknown>;
  if (typeof o.name !== "string" || !o.name.trim()) return null;
  if (!Array.isArray(o.rows)) return null;
  const rows: Array<{ content: string; metadata?: Record<string, unknown> }> = [];
  for (const r of o.rows) {
    if (r == null || typeof r !== "object") return null;
    const row = r as Record<string, unknown>;
    if (typeof row.content !== "string") return null;
    rows.push({
      content: row.content,
      metadata:
        row.metadata != null && typeof row.metadata === "object" && !Array.isArray(row.metadata)
          ? (row.metadata as Record<string, unknown>)
          : undefined,
    });
  }
  return { name: o.name.trim(), rows };
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = parseBody(body);
  if (!parsed) {
    return NextResponse.json(
      { error: "Body must be { name: string, rows: Array<{ content: string, metadata?: object }> }" },
      { status: 400 }
    );
  }

  const supabase = createServerSupabase();

  const { data: dataset, error: datasetError } = await supabase
    .from("datasets")
    .insert({ name: parsed.name })
    .select("id")
    .single();

  if (datasetError || !dataset?.id) {
    return NextResponse.json(
      { error: datasetError?.message ?? "Failed to create dataset" },
      { status: 500 }
    );
  }

  if (parsed.rows.length === 0) {
    return NextResponse.json({
      dataset_id: dataset.id,
      document_count: 0,
    });
  }

  const documents = parsed.rows.map((r) => ({
    dataset_id: dataset.id,
    content: r.content,
    metadata: r.metadata ?? {},
  }));

  const { error: docsError } = await supabase.from("documents").insert(documents);

  if (docsError) {
    return NextResponse.json(
      { error: docsError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    dataset_id: dataset.id,
    document_count: documents.length,
  });
}
