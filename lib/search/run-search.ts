import { rerankDocuments, type RerankOutcome } from "@/lib/llm/rerank";
import {
  HybridSearchError,
  loadSearchConfig,
  runHybridSearch,
  type HybridSearchConfig,
  type HybridSearchRow,
} from "@/lib/search/hybrid-search";

export type SearchResultRow = HybridSearchRow & {
  rerank_rank?: number;
  rerank_score?: number;
  original_rank?: number;
};

export type SearchRerankMeta = {
  enabled: boolean;
  model: string | null;
  candidate_count: number;
  fallback_used?: boolean;
};

export type RunSearchOutcome = {
  results: SearchResultRow[];
  rerank: SearchRerankMeta;
};

export { HybridSearchError, loadSearchConfig };
export type { HybridSearchConfig as SearchConfig };

export async function runSearch(params: {
  config: HybridSearchConfig;
  query: string;
  k: number;
}): Promise<RunSearchOutcome> {
  const { config, query, k } = params;

  if (!config.rerank_enabled) {
    const rows = await runHybridSearch({ config, query, k });
    return {
      results: rows,
      rerank: {
        enabled: false,
        model: null,
        candidate_count: k,
      },
    };
  }

  if (!config.rerank_model) {
    throw new HybridSearchError("rerank_model is required when rerank is enabled", 400);
  }

  const candidateK = Math.max(k, config.rerank_candidate_count);
  const candidates = await runHybridSearch({ config, query, k: candidateK });

  let rerankOutcome: RerankOutcome;
  try {
    rerankOutcome = await rerankDocuments({
      query,
      model: config.rerank_model,
      documents: candidates.map((row) => ({
        id: row.id,
        content: row.content,
        description: row.description,
        score: row.score,
      })),
      topK: k,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Rerank failed";
    throw new HybridSearchError(message, 500);
  }

  const byId = new Map(candidates.map((row) => [row.id, row]));
  const results: SearchResultRow[] = [];
  for (const item of rerankOutcome.results) {
    const row = byId.get(item.id);
    if (!row) continue;
    results.push({
      ...row,
      rerank_rank: item.rerank_rank,
      rerank_score: item.rerank_score,
      original_rank: item.original_rank,
    });
  }

  return {
    results,
    rerank: {
      enabled: true,
      model: config.rerank_model,
      candidate_count: candidateK,
      fallback_used: rerankOutcome.fallback_used,
    },
  };
}
