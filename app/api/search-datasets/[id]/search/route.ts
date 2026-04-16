import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { embedText, type EmbeddingDimension } from "@/lib/llm/embed";

type RouteContext = { params: Promise<{ id: string }> };

const MATCH_FUNCTIONS: Record<EmbeddingDimension, string> = {
  384: "match_search_documents_384",
  768: "match_search_documents_768",
  1536: "match_search_documents_1536",
  3072: "match_search_documents_3072",
};

function isEmbeddingDimension(value: unknown): value is EmbeddingDimension {
  return value === 384 || value === 768 || value === 1536 || value === 3072;
}

function parseK(raw: string | null): number {
  const parsed = raw ? Number.parseInt(raw, 10) : NaN;
  if (!Number.isFinite(parsed) || parsed <= 0) return 10;
  return Math.min(parsed, 100);
}

function buildSnippet(content: string): string {
  const max = 240;
  const base = content ?? "";
  if (base.length <= max) return base;
  return `${base.slice(0, max - 1).trimEnd()}…`;
}

export async function GET(request: Request, context: RouteContext) {
  const { id: searchDatasetId } = await context.params;
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim();
  const k = parseK(searchParams.get("k"));

  if (!q) {
    return NextResponse.json({ error: "Query parameter `q` is required" }, { status: 400 });
  }

  const supabase = createServerSupabase();

  const { data: searchDataset, error: sdError } = await supabase
    .from("search_datasets")
    .select("id, embedding_model, embedding_dimension, status")
    .eq("id", searchDatasetId)
    .single();

  if (sdError || !searchDataset) {
    return NextResponse.json(
      { error: sdError?.message ?? "Search dataset not found" },
      { status: 404 }
    );
  }

  if (!searchDataset.embedding_model || !isEmbeddingDimension(searchDataset.embedding_dimension)) {
    return NextResponse.json(
      {
        error:
          "embedding_model and a valid embedding_dimension (384, 768, 1536, or 3072) are required on the search dataset",
      },
      { status: 400 }
    );
  }

  let queryEmbedding: number[];
  try {
    queryEmbedding = await embedText({
      input: q,
      model: searchDataset.embedding_model,
      dimensions: searchDataset.embedding_dimension,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to embed query" },
      { status: 500 }
    );
  }

  const rpcName = MATCH_FUNCTIONS[searchDataset.embedding_dimension];
  // pgvector accepts its text representation "[v1,v2,...]" when passed via PostgREST.
  const embeddingLiteral = `[${queryEmbedding.join(",")}]`;

  const { data: results, error: rpcError } = await supabase.rpc(rpcName, {
    p_search_dataset_id: searchDatasetId,
    p_query: q,
    p_query_embedding: embeddingLiteral,
    p_k: k,
  });

  if (rpcError) {
    return NextResponse.json({ error: rpcError.message }, { status: 500 });
  }

  type Row = {
    id: string;
    document_id: string;
    content: string;
    description: string | null;
    vector_similarity: number;
    fts_rank: number;
    score: number;
  };

  const rows = (results ?? []) as Row[];
  const formatted = rows.map((row) => ({
    id: row.id,
    document_id: row.document_id,
    content: row.content,
    description: row.description,
    snippet: buildSnippet(row.content),
    vector_similarity: row.vector_similarity,
    fts_rank: row.fts_rank,
    score: row.score,
  }));

  return NextResponse.json({
    query: q,
    k,
    embedding_dimension: searchDataset.embedding_dimension,
    result_count: formatted.length,
    results: formatted,
  });
}
