import { embedText, type EmbeddingDimension } from "@/lib/llm/embed";
import { createServerSupabase } from "@/lib/supabase/server";

const MATCH_FUNCTIONS: Record<EmbeddingDimension, string> = {
  384: "match_search_documents_384",
  768: "match_search_documents_768",
  1536: "match_search_documents_1536",
  3072: "match_search_documents_3072",
};

export function isEmbeddingDimension(value: unknown): value is EmbeddingDimension {
  return value === 384 || value === 768 || value === 1536 || value === 3072;
}

export type HybridSearchRow = {
  id: string;
  document_id: string;
  content: string;
  description: string | null;
  vector_similarity: number;
  fts_rank: number;
  score: number;
};

export type HybridSearchConfig = {
  id: string;
  embedding_model: string;
  embedding_dimension: EmbeddingDimension;
};

export class HybridSearchError extends Error {
  status: number;
  constructor(message: string, status = 500) {
    super(message);
    this.status = status;
  }
}

export async function loadSearchConfig(searchDatasetId: string): Promise<HybridSearchConfig> {
  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from("search_datasets")
    .select("id, embedding_model, embedding_dimension")
    .eq("id", searchDatasetId)
    .single();

  if (error || !data) {
    throw new HybridSearchError(error?.message ?? "Search dataset not found", 404);
  }
  if (!data.embedding_model || !isEmbeddingDimension(data.embedding_dimension)) {
    throw new HybridSearchError(
      "embedding_model and a valid embedding_dimension (384, 768, 1536, or 3072) are required on the search dataset",
      400
    );
  }
  return {
    id: data.id,
    embedding_model: data.embedding_model,
    embedding_dimension: data.embedding_dimension,
  };
}

export async function runHybridSearch(params: {
  config: HybridSearchConfig;
  query: string;
  k: number;
}): Promise<HybridSearchRow[]> {
  const { config, query, k } = params;

  const queryEmbedding = await embedText({
    input: query,
    model: config.embedding_model,
    dimensions: config.embedding_dimension,
  });

  const supabase = createServerSupabase();
  const rpcName = MATCH_FUNCTIONS[config.embedding_dimension];
  // pgvector accepts its text representation "[v1,v2,...]" when passed via PostgREST.
  const embeddingLiteral = `[${queryEmbedding.join(",")}]`;

  const { data, error } = await supabase.rpc(rpcName, {
    p_search_dataset_id: config.id,
    p_query: query,
    p_query_embedding: embeddingLiteral,
    p_k: k,
  });

  if (error) {
    throw new HybridSearchError(error.message, 500);
  }

  return (data ?? []) as HybridSearchRow[];
}
