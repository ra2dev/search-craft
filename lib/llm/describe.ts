const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1";

type ChatCompletionResponse = {
  choices?: Array<{ message?: { content?: string } }>;
  error?: { message?: string };
};

export type DescribeOptions = {
  prompt: string;
  content: string;
  model: string;
  signal?: AbortSignal;
};

export async function describeDocument({
  prompt,
  content,
  model,
  signal,
}: DescribeOptions): Promise<string> {
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
      messages: [
        { role: "system", content: prompt },
        { role: "user", content },
      ],
    }),
    signal,
  });

  const data = (await res.json().catch(() => ({}))) as ChatCompletionResponse;
  if (!res.ok) {
    const message = data.error?.message ?? `LLM request failed (${res.status})`;
    throw new Error(message);
  }

  const description = data.choices?.[0]?.message?.content?.trim();
  if (!description) {
    throw new Error("LLM returned empty description");
  }
  return description;
}
