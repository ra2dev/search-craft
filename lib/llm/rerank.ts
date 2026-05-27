const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1";

const DEFAULT_CANDIDATE_COUNT = 50;
const MAX_CANDIDATE_COUNT = 100;

type ChatCompletionResponse = {
  choices?: Array<{ message?: { content?: string } }>;
  error?: { message?: string };
};

export type RerankCandidate = {
  id: string;
  content: string;
  description: string | null;
  score: number;
};

export type RerankResultItem = RerankCandidate & {
  rerank_rank: number;
  rerank_score: number;
  original_rank: number;
  original_score: number;
};

export type RerankOutcome = {
  results: RerankResultItem[];
  fallback_used: boolean;
};

export function normalizeRerankCandidateCount(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_CANDIDATE_COUNT;
  return Math.min(Math.floor(parsed), MAX_CANDIDATE_COUNT);
}

function documentText(content: string, description: string | null): string {
  const base = content.trim();
  const desc = description?.trim();
  if (!desc) return base;
  if (!base) return desc;
  return `${base}\n\n${desc}`;
}

function buildPrompt(query: string, documents: RerankCandidate[]): string {
  const lines = documents.map((doc, i) => {
    const text = documentText(doc.content, doc.description);
    return `[${i}] ${text}`;
  });
  return [
    `Query: ${query}`,
    "",
    "Rank these documents by relevance to the query (most relevant first).",
    "Return JSON only: {\"ranked_indices\": [<0-based indices in best-to-worst order, each index exactly once>]}",
    "",
    ...lines,
  ].join("\n");
}

function parseRankedIndices(
  content: string,
  documentCount: number
): number[] | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const indices = (parsed as { ranked_indices?: unknown }).ranked_indices;
  if (!Array.isArray(indices) || indices.length !== documentCount) return null;

  const seen = new Set<number>();
  for (const raw of indices) {
    if (typeof raw !== "number" || !Number.isInteger(raw)) return null;
    if (raw < 0 || raw >= documentCount || seen.has(raw)) return null;
    seen.add(raw);
  }
  if (seen.size !== documentCount) return null;
  return indices as number[];
}

function applyOrder(
  documents: RerankCandidate[],
  order: number[],
  topK: number
): RerankResultItem[] {
  const results: RerankResultItem[] = [];
  for (let i = 0; i < Math.min(order.length, topK); i++) {
    const idx = order[i];
    const doc = documents[idx];
    const originalRank = idx + 1;
    const rerankRank = i + 1;
    results.push({
      ...doc,
      rerank_rank: rerankRank,
      rerank_score: 1 / rerankRank,
      original_rank: originalRank,
      original_score: doc.score,
    });
  }
  return results;
}

function hybridOrder(documents: RerankCandidate[], topK: number): RerankResultItem[] {
  const order = documents.map((_, i) => i);
  return applyOrder(documents, order, topK);
}

export async function rerankDocuments(params: {
  query: string;
  model: string;
  documents: RerankCandidate[];
  topK: number;
  signal?: AbortSignal;
}): Promise<RerankOutcome> {
  const { query, model, documents, topK, signal } = params;
  if (documents.length === 0) {
    return { results: [], fallback_used: false };
  }
  if (documents.length === 1) {
    return {
      results: hybridOrder(documents, topK),
      fallback_used: false,
    };
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set");
  }

  const res = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are a search relevance ranker. Output only valid JSON with ranked_indices.",
        },
        { role: "user", content: buildPrompt(query, documents) },
      ],
    }),
    signal,
  });

  const data = (await res.json().catch(() => ({}))) as ChatCompletionResponse;
  if (!res.ok) {
    const message = data.error?.message ?? `Rerank request failed (${res.status})`;
    throw new Error(message);
  }

  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) {
    return { results: hybridOrder(documents, topK), fallback_used: true };
  }

  const order = parseRankedIndices(content, documents.length);
  if (!order) {
    return { results: hybridOrder(documents, topK), fallback_used: true };
  }

  return { results: applyOrder(documents, order, topK), fallback_used: false };
}
