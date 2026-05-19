"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";

type DatasetSummary = { id: string; name: string };

type ValidationSetSummary = {
  id: string;
  name: string;
  query_count: number;
};

type SearchConfig = {
  id: string;
  name: string;
  dataset_id: string;
  dataset_name: string;
  status: string;
  latest_validation: {
    validation_set_id: string;
    validation_set_name: string;
    run_at: string;
    mrr: number;
    pass_rate: number;
    recall_at_max_rank: number;
  } | null;
};

function formatMrr(mrr: number | null | undefined): string {
  if (mrr == null) return "—";
  return mrr.toFixed(4);
}

function formatPct(rate: number | null | undefined): string {
  if (rate == null) return "—";
  return `${(rate * 100).toFixed(1)}%`;
}

export default function CompareConfigsPage() {
  const [datasets, setDatasets] = useState<DatasetSummary[]>([]);
  const [datasetId, setDatasetId] = useState("");
  const [validationSets, setValidationSets] = useState<ValidationSetSummary[]>([]);
  const [validationSetId, setValidationSetId] = useState("");
  const [configs, setConfigs] = useState<SearchConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/datasets")
      .then((res) => (res.ok ? res.json() : []))
      .then((data: DatasetSummary[]) => {
        setDatasets(data ?? []);
        if (data?.[0]?.id) setDatasetId(data[0].id);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!datasetId) {
      setValidationSets([]);
      setValidationSetId("");
      return;
    }
    fetch(`/api/datasets/${datasetId}/validation-sets`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data: ValidationSetSummary[]) => {
        setValidationSets(data ?? []);
        setValidationSetId((prev) => {
          if (prev && data?.some((s) => s.id === prev)) return prev;
          return data?.[0]?.id ?? "";
        });
      })
      .catch(() => {
        setValidationSets([]);
        setValidationSetId("");
      });
  }, [datasetId]);

  const loadConfigs = useCallback(() => {
    if (!datasetId) return;
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ dataset_id: datasetId });
    if (validationSetId) params.set("validation_set_id", validationSetId);
    fetch(`/api/search-configs?${params.toString()}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(res.statusText))))
      .then((data: SearchConfig[]) => setConfigs(data ?? []))
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load");
        setConfigs([]);
      })
      .finally(() => setLoading(false));
  }, [datasetId, validationSetId]);

  useEffect(() => {
    loadConfigs();
  }, [loadConfigs]);

  const bestMrr =
    configs.length === 0
      ? null
      : configs.reduce<number | null>((best, c) => {
          const m = c.latest_validation?.mrr;
          if (m == null) return best;
          if (best == null || m > best) return m;
          return best;
        }, null);

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator
              orientation="vertical"
              className="mr-2 data-[orientation=vertical]:h-4"
            />
            <span className="font-medium">Compare configs</span>
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-6 p-4 pt-0">
          <div className="flex flex-wrap items-end gap-4">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-muted-foreground">Dataset</span>
              <select
                className="flex h-9 min-w-48 rounded-md border border-input bg-background px-3 py-1 text-sm"
                value={datasetId}
                onChange={(e) => setDatasetId(e.target.value)}
              >
                {datasets.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-muted-foreground">Validation set</span>
              <select
                className="flex h-9 min-w-48 rounded-md border border-input bg-background px-3 py-1 text-sm"
                value={validationSetId}
                onChange={(e) => setValidationSetId(e.target.value)}
                disabled={validationSets.length === 0}
              >
                {validationSets.length === 0 ? (
                  <option value="">No validation sets</option>
                ) : (
                  validationSets.map((vs) => (
                    <option key={vs.id} value={vs.id}>
                      {vs.name} ({vs.query_count})
                    </option>
                  ))
                )}
              </select>
            </label>
            <Link
              href="/search"
              className="text-sm text-muted-foreground underline underline-offset-2 pb-2"
            >
              Back to search
            </Link>
          </div>

          {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {error && <p className="text-sm text-destructive">{error}</p>}
          {!loading && !error && configs.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No vectorized configs for this dataset.
            </p>
          )}
          {configs.length > 0 && (
            <div className="overflow-hidden rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Config</th>
                    <th className="px-3 py-2 text-right font-medium">MRR</th>
                    <th className="px-3 py-2 text-right font-medium">Pass rate</th>
                    <th className="px-3 py-2 text-right font-medium">Recall@max</th>
                    <th className="px-3 py-2 text-left font-medium">Last run</th>
                  </tr>
                </thead>
                <tbody>
                  {configs.map((c) => {
                    const mrr = c.latest_validation?.mrr;
                    const isBest = bestMrr != null && mrr === bestMrr;
                    return (
                      <tr
                        key={c.id}
                        className={`border-t align-top ${isBest ? "bg-green-50 dark:bg-green-950/30" : ""}`}
                      >
                        <td className="px-3 py-2 font-medium">
                          <Link
                            href="/search"
                            className="underline underline-offset-2"
                            onClick={() => {
                              localStorage.setItem("search-workspace-config-id", c.id);
                            }}
                          >
                            {c.name}
                          </Link>
                        </td>
                        <td className="px-3 py-2 text-right font-mono">
                          {formatMrr(mrr)}
                          {isBest && (
                            <span className="ml-1 text-xs text-green-700 dark:text-green-400">
                              best
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right font-mono">
                          {formatPct(c.latest_validation?.pass_rate)}
                        </td>
                        <td className="px-3 py-2 text-right font-mono">
                          {formatPct(c.latest_validation?.recall_at_max_rank)}
                        </td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">
                          {c.latest_validation
                            ? new Date(c.latest_validation.run_at).toLocaleString()
                            : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
