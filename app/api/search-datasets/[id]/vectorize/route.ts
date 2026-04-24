import { NextResponse } from "next/server";
import { POSTGREST_MAX_ROWS } from "@/lib/supabase/postgrest-limits";
import { createServerSupabase } from "@/lib/supabase/server";
import { embedText, type EmbeddingDimension } from "@/lib/llm/embed";

type RouteContext = { params: Promise<{ id: string }> };

const EMBEDDING_COLUMNS: Record<EmbeddingDimension, string> = {
  384: "embedding_384",
  768: "embedding_768",
  1536: "embedding_1536",
  3072: "embedding_3072",
};

function isEmbeddingDimension(value: unknown): value is EmbeddingDimension {
  return value === 384 || value === 768 || value === 1536 || value === 3072;
}

export async function POST(_request: Request, context: RouteContext) {
  const { id: searchDatasetId } = await context.params;
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

  const embeddingColumn = EMBEDDING_COLUMNS[searchDataset.embedding_dimension];

  let vectorizedCount = 0;
  const failures: Array<{ id: string; error: string }> = [];
  let totalPendingThisRun = 0;
  let sawAnyPending = false;
  /** If the same leading row is still pending after a batch with zero successes, stop (avoids infinite loop). */
  let prevStuckFirstId: string | null = null;

  while (true) {
    const { data: pending, error: docsError } = await supabase
      .from("search_documents")
      .select("id, content, description")
      .eq("search_dataset_id", searchDatasetId)
      .is(embeddingColumn, null)
      .order("id", { ascending: true })
      .limit(POSTGREST_MAX_ROWS);

    if (docsError) {
      return NextResponse.json({ error: docsError.message }, { status: 500 });
    }

    if (!pending || pending.length === 0) {
      break;
    }

    sawAnyPending = true;
    totalPendingThisRun += pending.length;

    let batchVectorized = 0;
    for (const doc of pending) {
      try {
        const input = doc.description
          ? `${doc.content}\n\n${doc.description}`
          : doc.content;

        const embedding = await embedText({
          input,
          model: searchDataset.embedding_model,
          dimensions: searchDataset.embedding_dimension,
        });

        const { error: updateError } = await supabase
          .from("search_documents")
          .update({ [embeddingColumn]: embedding })
          .eq("id", doc.id);

        if (updateError) {
          failures.push({ id: doc.id, error: updateError.message });
          continue;
        }

        vectorizedCount += 1;
        batchVectorized += 1;
      } catch (err) {
        failures.push({ id: doc.id, error: err instanceof Error ? err.message : "Unknown error" });
      }
    }

    if (pending.length < POSTGREST_MAX_ROWS) {
      break;
    }
    if (batchVectorized === 0) {
      const firstId = pending[0].id;
      if (prevStuckFirstId === firstId) {
        break;
      }
      prevStuckFirstId = firstId;
    } else {
      prevStuckFirstId = null;
    }
  }

  if (!sawAnyPending) {
    if (searchDataset.status !== "vectorized") {
      await supabase
        .from("search_datasets")
        .update({ status: "vectorized" })
        .eq("id", searchDatasetId);
    }
    return NextResponse.json({ vectorized_count: 0, failed_count: 0, total_pending: 0 });
  }

  if (failures.length === 0) {
    const { error: statusError } = await supabase
      .from("search_datasets")
      .update({ status: "vectorized" })
      .eq("id", searchDatasetId);

    if (statusError) {
      return NextResponse.json(
        {
          vectorized_count: vectorizedCount,
          failed_count: 0,
          status_update_error: statusError.message,
        },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({
    vectorized_count: vectorizedCount,
    failed_count: failures.length,
    total_pending: totalPendingThisRun,
    failures: failures.length > 0 ? failures : undefined,
  });
}
