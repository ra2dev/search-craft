import { NextResponse } from "next/server";
import {
  HybridSearchError,
  loadSearchConfig,
  runSearch,
} from "@/lib/search/run-search";

type RouteContext = { params: Promise<{ id: string }> };

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

  let config;
  try {
    config = await loadSearchConfig(searchDatasetId);
  } catch (err) {
    if (err instanceof HybridSearchError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }

  let outcome;
  try {
    outcome = await runSearch({ config, query: q, k });
  } catch (err) {
    if (err instanceof HybridSearchError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Search failed" },
      { status: 500 }
    );
  }

  const formatted = outcome.results.map((row) => ({
    id: row.id,
    document_id: row.document_id,
    content: row.content,
    description: row.description,
    snippet: buildSnippet(row.content),
    vector_similarity: row.vector_similarity,
    fts_rank: row.fts_rank,
    score: row.score,
    ...(row.rerank_rank != null
      ? {
          rerank_rank: row.rerank_rank,
          rerank_score: row.rerank_score,
          original_rank: row.original_rank,
        }
      : {}),
  }));

  return NextResponse.json({
    query: q,
    k,
    embedding_dimension: config.embedding_dimension,
    result_count: formatted.length,
    rerank: outcome.rerank,
    results: formatted,
  });
}
