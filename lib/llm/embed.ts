const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1";

export type EmbeddingDimension = 384 | 768 | 1536 | 3072;

type EmbeddingResponse = {
  data?: Array<{ embedding?: number[] }>;
  error?: { message?: string };
};

export type EmbedOptions = {
  input: string;
  model: string;
  dimensions: EmbeddingDimension;
  signal?: AbortSignal;
};

export async function embedText({
  input,
  model,
  dimensions,
  signal,
}: EmbedOptions): Promise<number[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set");
  }

  const res = await fetch(`${OPENAI_BASE_URL}/embeddings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      input,
      dimensions,
    }),
    signal,
  });

  const data = (await res.json().catch(() => ({}))) as EmbeddingResponse;
  if (!res.ok) {
    const message = data.error?.message ?? `Embedding request failed (${res.status})`;
    throw new Error(message);
  }

  const embedding = data.data?.[0]?.embedding;
  if (!embedding || embedding.length === 0) {
    throw new Error("Embedding API returned empty vector");
  }
  if (embedding.length !== dimensions) {
    throw new Error(
      `Embedding API returned ${embedding.length} dimensions, expected ${dimensions}`
    );
  }
  return embedding;
}
