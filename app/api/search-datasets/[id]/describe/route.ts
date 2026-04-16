import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { describeDocument } from "@/lib/llm/describe";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const { id: searchDatasetId } = await context.params;
  const supabase = createServerSupabase();

  const { data: searchDataset, error: sdError } = await supabase
    .from("search_datasets")
    .select("id, description_prompt, description_model, status")
    .eq("id", searchDatasetId)
    .single();

  if (sdError || !searchDataset) {
    return NextResponse.json({ error: sdError?.message ?? "Search dataset not found" }, { status: 404 });
  }

  if (!searchDataset.description_prompt || !searchDataset.description_model) {
    return NextResponse.json(
      { error: "description_prompt and description_model are required on the search dataset" },
      { status: 400 }
    );
  }

  const { data: pending, error: docsError } = await supabase
    .from("search_documents")
    .select("id, content")
    .eq("search_dataset_id", searchDatasetId)
    .is("description", null);

  if (docsError) {
    return NextResponse.json({ error: docsError.message }, { status: 500 });
  }

  if (!pending || pending.length === 0) {
    if (searchDataset.status !== "described" && searchDataset.status !== "vectorized") {
      await supabase
        .from("search_datasets")
        .update({ status: "described" })
        .eq("id", searchDatasetId);
    }
    return NextResponse.json({ described_count: 0, failed_count: 0, total_pending: 0 });
  }

  let describedCount = 0;
  const failures: Array<{ id: string; error: string }> = [];

  for (const doc of pending) {
    try {
      const description = await describeDocument({
        prompt: searchDataset.description_prompt,
        content: doc.content,
        model: searchDataset.description_model,
      });

      const { error: updateError } = await supabase
        .from("search_documents")
        .update({ description })
        .eq("id", doc.id);

      if (updateError) {
        failures.push({ id: doc.id, error: updateError.message });
        continue;
      }

      describedCount += 1;
    } catch (err) {
      failures.push({ id: doc.id, error: err instanceof Error ? err.message : "Unknown error" });
    }
  }

  if (failures.length === 0) {
    const { error: statusError } = await supabase
      .from("search_datasets")
      .update({ status: "described" })
      .eq("id", searchDatasetId);

    if (statusError) {
      return NextResponse.json(
        { described_count: describedCount, failed_count: 0, status_update_error: statusError.message },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({
    described_count: describedCount,
    failed_count: failures.length,
    total_pending: pending.length,
    failures: failures.length > 0 ? failures : undefined,
  });
}
