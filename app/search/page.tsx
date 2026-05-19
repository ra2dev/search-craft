"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";

const CONFIG_STORAGE_KEY = "search-workspace-config-id";
const RUN_VALIDATION_SET_STORAGE_KEY = "search-workspace-run-validation-set-id";
const MRR_FILTER_STORAGE_KEY = "search-workspace-mrr-filter-set-id";

type SearchConfig = {
  id: string;
  name: string;
  dataset_id: string;
  dataset_name: string;
  status: string;
  embedding_dimension: number | null;
  document_count: number;
  vectorized_count: number;
  latest_validation: {
    validation_set_id: string;
    validation_set_name: string;
    run_at: string;
    mrr: number;
    pass_rate: number;
    recall_at_max_rank: number;
  } | null;
};

type SearchResultItem = {
  id: string;
  document_id: string;
  content: string;
  description: string | null;
  snippet: string;
  vector_similarity: number;
  fts_rank: number;
  score: number;
};

type SearchResponse = {
  query: string;
  k: number;
  embedding_dimension: number;
  result_count: number;
  results: SearchResultItem[];
};

type ValidationSetSummary = {
  id: string;
  name: string;
  query_count: number;
};

type ValidationRunMetrics = {
  total_queries: number;
  pass_rate: number;
  recall_at_max_rank: number;
  mrr: number;
};

type ValidationRunResponse = {
  run_id: string;
  run_at: string;
  metrics: ValidationRunMetrics;
};

function formatMrr(mrr: number | null | undefined): string {
  if (mrr == null) return "—";
  return mrr.toFixed(4);
}

function formatPct(rate: number | null | undefined): string {
  if (rate == null) return "—";
  return `${(rate * 100).toFixed(1)}%`;
}

export default function SearchWorkspacePage() {
  const [configs, setConfigs] = useState<SearchConfig[]>([]);
  const [loadingConfigs, setLoadingConfigs] = useState(true);
  const [configsError, setConfigsError] = useState<string | null>(null);
  const [activeConfigId, setActiveConfigId] = useState<string>("");
  const [mrrFilterSetId, setMrrFilterSetId] = useState<string>("");
  const [runValidationSetId, setRunValidationSetId] = useState<string>("");

  const [searchQuery, setSearchQuery] = useState("");
  const [searchK, setSearchK] = useState(10);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchResponse, setSearchResponse] = useState<SearchResponse | null>(null);

  const [validationSets, setValidationSets] = useState<ValidationSetSummary[]>([]);
  const [runningValidation, setRunningValidation] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [validationRun, setValidationRun] = useState<ValidationRunResponse | null>(null);

  const activeConfig = configs.find((c) => c.id === activeConfigId) ?? null;

  const loadConfigs = useCallback(() => {
    setLoadingConfigs(true);
    setConfigsError(null);
    const params = new URLSearchParams();
    if (mrrFilterSetId) params.set("validation_set_id", mrrFilterSetId);
    const qs = params.toString();
    return fetch(`/api/search-configs${qs ? `?${qs}` : ""}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(res.statusText))))
      .then((data: SearchConfig[]) => {
        setConfigs(data ?? []);
        return data ?? [];
      })
      .catch((err) => {
        setConfigsError(err instanceof Error ? err.message : "Failed to load configs");
        setConfigs([]);
        return [] as SearchConfig[];
      })
      .finally(() => setLoadingConfigs(false));
  }, [mrrFilterSetId]);

  useEffect(() => {
    loadConfigs().then((data) => {
      if (data.length === 0) return;
      const stored =
        typeof window !== "undefined"
          ? localStorage.getItem(CONFIG_STORAGE_KEY)
          : null;
      const pick =
        (stored && data.some((c) => c.id === stored) ? stored : null) ??
        data[0]?.id ??
        "";
      setActiveConfigId(pick);
    });
  }, [loadConfigs]);

  useEffect(() => {
    if (!activeConfigId) return;
    localStorage.setItem(CONFIG_STORAGE_KEY, activeConfigId);
  }, [activeConfigId]);

  useEffect(() => {
    if (!activeConfig?.dataset_id) {
      setValidationSets([]);
      return;
    }
    fetch(`/api/datasets/${activeConfig.dataset_id}/validation-sets`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data: ValidationSetSummary[]) => {
        setValidationSets(data ?? []);
        const storedRun = localStorage.getItem(RUN_VALIDATION_SET_STORAGE_KEY);
        setRunValidationSetId((prev) => {
          if (prev && data?.some((s) => s.id === prev)) return prev;
          if (storedRun && data?.some((s) => s.id === storedRun)) return storedRun;
          return data?.[0]?.id ?? "";
        });
        const storedFilter = localStorage.getItem(MRR_FILTER_STORAGE_KEY);
        if (storedFilter && data?.some((s) => s.id === storedFilter)) {
          setMrrFilterSetId(storedFilter);
        }
      })
      .catch(() => setValidationSets([]));
  }, [activeConfig?.dataset_id]);

  useEffect(() => {
    if (runValidationSetId) {
      localStorage.setItem(RUN_VALIDATION_SET_STORAGE_KEY, runValidationSetId);
    }
  }, [runValidationSetId]);

  useEffect(() => {
    localStorage.setItem(MRR_FILTER_STORAGE_KEY, mrrFilterSetId);
  }, [mrrFilterSetId]);

  async function handleRunSearch(event?: React.FormEvent) {
    event?.preventDefault();
    if (!activeConfigId) {
      setSearchError("Select a search config first.");
      return;
    }
    const query = searchQuery.trim();
    if (!query) {
      setSearchError("Enter a query to search.");
      return;
    }
    setSearching(true);
    setSearchError(null);
    setSearchResponse(null);
    try {
      const params = new URLSearchParams({ q: query, k: String(searchK) });
      const res = await fetch(
        `/api/search-datasets/${activeConfigId}/search?${params.toString()}`
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSearchError(data.error ?? "Search failed");
        return;
      }
      setSearchResponse(data as SearchResponse);
    } catch {
      setSearchError("Network error");
    } finally {
      setSearching(false);
    }
  }

  async function handleRunValidation(e?: React.FormEvent) {
    e?.preventDefault();
    if (!activeConfigId) return;
    const setId = runValidationSetId;
    if (!setId) {
      setValidationError("Select a validation set first.");
      return;
    }
    setRunningValidation(true);
    setValidationError(null);
    setValidationRun(null);
    try {
      const res = await fetch(`/api/search-datasets/${activeConfigId}/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ validation_set_id: setId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setValidationError(data.error ?? "Validation failed");
        return;
      }
      setValidationRun(data as ValidationRunResponse);
      await loadConfigs();
    } catch {
      setValidationError("Network error");
    } finally {
      setRunningValidation(false);
    }
  }

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
            <span className="font-medium">Search</span>
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-6 p-4 pt-0 lg:flex-row">
          <section className="space-y-3 lg:w-[min(100%,28rem)] lg:shrink-0">
            <div className="flex items-center justify-between gap-2">
              <h1 className="text-lg font-semibold">Configs</h1>
              <Link
                href="/search/compare"
                className="text-xs text-muted-foreground underline underline-offset-2"
              >
                Compare
              </Link>
            </div>
            {validationSets.length > 0 && (
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-muted-foreground">Validation set (MRR filter)</span>
                <select
                  className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                  value={mrrFilterSetId}
                  onChange={(e) => setMrrFilterSetId(e.target.value)}
                >
                  <option value="">Latest run (any set)</option>
                  {validationSets.map((vs) => (
                    <option key={vs.id} value={vs.id}>
                      {vs.name} ({vs.query_count})
                    </option>
                  ))}
                </select>
              </label>
            )}
            {loadingConfigs && (
              <p className="text-sm text-muted-foreground">Loading configs…</p>
            )}
            {configsError && (
              <p className="text-sm text-destructive">{configsError}</p>
            )}
            {!loadingConfigs && !configsError && configs.length === 0 && (
              <div className="rounded-md border p-4 text-sm text-muted-foreground">
                <p>No vectorized search configs yet.</p>
                <p className="mt-2">
                  <Link href="/datasets/upload" className="underline underline-offset-2">
                    Upload a dataset
                  </Link>
                  , create a search config, then describe and vectorize it.
                </p>
              </div>
            )}
            {configs.length > 0 && (
              <div className="overflow-hidden rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-2 py-2 text-left font-medium">Dataset</th>
                      <th className="px-2 py-2 text-left font-medium">Config</th>
                      <th className="px-2 py-2 text-right font-medium">MRR</th>
                      <th className="px-2 py-2 text-right font-medium">Pass</th>
                    </tr>
                  </thead>
                  <tbody>
                    {configs.map((c) => {
                      const selected = c.id === activeConfigId;
                      return (
                        <tr
                          key={c.id}
                          className={`cursor-pointer border-t align-top ${
                            selected ? "bg-muted/60" : "hover:bg-muted/30"
                          }`}
                          onClick={() => {
                            setActiveConfigId(c.id);
                            setSearchResponse(null);
                            setValidationRun(null);
                          }}
                        >
                          <td className="px-2 py-2 text-xs">{c.dataset_name}</td>
                          <td className="px-2 py-2 font-medium">{c.name}</td>
                          <td className="px-2 py-2 text-right font-mono text-xs">
                            {formatMrr(c.latest_validation?.mrr)}
                          </td>
                          <td className="px-2 py-2 text-right font-mono text-xs">
                            {formatPct(c.latest_validation?.pass_rate)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="min-w-0 flex-1 space-y-4">
            {!activeConfig ? (
              <p className="text-sm text-muted-foreground">
                Select a config to run queries.
              </p>
            ) : (
              <>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <h2 className="text-lg font-semibold">{activeConfig.name}</h2>
                    <p className="text-sm text-muted-foreground">
                      {activeConfig.dataset_name} · {activeConfig.vectorized_count} vectorized
                      docs
                    </p>
                  </div>
                  {activeConfig.latest_validation && (
                    <div className="rounded-md border px-3 py-1.5 text-xs">
                      <span className="text-muted-foreground">MRR </span>
                      <span className="font-mono font-medium">
                        {formatMrr(activeConfig.latest_validation.mrr)}
                      </span>
                      <span className="mx-2 text-muted-foreground">·</span>
                      <span className="text-muted-foreground">pass </span>
                      <span className="font-mono">
                        {formatPct(activeConfig.latest_validation.pass_rate)}
                      </span>
                      <span className="mx-2 text-muted-foreground">·</span>
                      <span className="text-muted-foreground">
                        {new Date(activeConfig.latest_validation.run_at).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </div>

                <form onSubmit={handleRunSearch} className="flex flex-wrap items-center gap-2">
                  <Input
                    type="text"
                    placeholder="Type a query…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="max-w-lg flex-1"
                    disabled={searching}
                  />
                  <label className="flex items-center gap-2 text-sm text-muted-foreground">
                    k
                    <Input
                      type="number"
                      min={1}
                      max={100}
                      value={searchK}
                      onChange={(e) =>
                        setSearchK(Math.max(1, Math.min(100, Number(e.target.value) || 10)))
                      }
                      className="w-20"
                      disabled={searching}
                    />
                  </label>
                  <Button type="submit" disabled={searching}>
                    {searching ? "Searching…" : "Search"}
                  </Button>
                  <Link
                    href={`/search-datasets/${activeConfig.id}`}
                    className="text-xs text-muted-foreground underline underline-offset-2"
                  >
                    Manage config
                  </Link>
                </form>
                {searchError && <p className="text-sm text-destructive">{searchError}</p>}
                {searchResponse && (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">
                      {searchResponse.result_count === 0
                        ? "No results."
                        : `Top ${searchResponse.result_count} for “${searchResponse.query}”`}
                    </p>
                    <ol className="space-y-2">
                      {searchResponse.results.map((r, idx) => (
                        <li key={r.id} className="rounded-md border p-3 text-sm">
                          <div className="mb-1 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                            <span>
                              #{idx + 1} · doc {r.document_id.slice(0, 8)}
                            </span>
                            <span className="font-mono">
                              score {r.score.toFixed(4)} · vec{" "}
                              {r.vector_similarity.toFixed(3)} · fts {r.fts_rank.toFixed(3)}
                            </span>
                          </div>
                          <div className="whitespace-pre-wrap break-words">{r.snippet}</div>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}

                <div className="border-t pt-4 space-y-3">
                  <h3 className="text-sm font-medium">Validation</h3>
                  {validationSets.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No validation sets on this dataset.{" "}
                      <Link
                        href={`/datasets/${activeConfig.dataset_id}`}
                        className="underline underline-offset-2"
                      >
                        Create one
                      </Link>
                      .
                    </p>
                  ) : (
                    <form
                      onSubmit={handleRunValidation}
                      className="flex flex-wrap items-center gap-2"
                    >
                      <select
                        className="flex h-9 min-w-48 rounded-md border border-input bg-background px-3 py-1 text-sm"
                        value={runValidationSetId}
                        onChange={(e) => setRunValidationSetId(e.target.value)}
                        disabled={runningValidation}
                      >
                        {validationSets.map((vs) => (
                          <option key={vs.id} value={vs.id}>
                            {vs.name} ({vs.query_count})
                          </option>
                        ))}
                      </select>
                      <Button type="submit" disabled={!runValidationSetId || runningValidation}>
                        {runningValidation ? "Running…" : "Run validation"}
                      </Button>
                    </form>
                  )}
                  {validationError && (
                    <p className="text-sm text-destructive">{validationError}</p>
                  )}
                  {validationRun && (
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-md border p-3 text-sm sm:grid-cols-4">
                      <div>
                        <div className="text-xs text-muted-foreground">Queries</div>
                        <div className="font-mono">{validationRun.metrics.total_queries}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Pass rate</div>
                        <div className="font-mono">
                          {formatPct(validationRun.metrics.pass_rate)}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Recall@max_rank</div>
                        <div className="font-mono">
                          {formatPct(validationRun.metrics.recall_at_max_rank)}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">MRR</div>
                        <div className="font-mono">
                          {formatMrr(validationRun.metrics.mrr)}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </section>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
