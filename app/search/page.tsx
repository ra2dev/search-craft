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

type SearchConfig = {
  id: string;
  name: string;
  dataset_id: string;
  dataset_name: string;
  status: string;
  embedding_dimension: number | null;
  rerank_enabled: boolean;
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
  rerank_rank?: number;
  rerank_score?: number;
  original_rank?: number;
};

type SearchRerankMeta = {
  enabled: boolean;
  model: string | null;
  candidate_count: number;
  fallback_used?: boolean;
};

type SearchResponse = {
  query: string;
  k: number;
  embedding_dimension: number;
  result_count: number;
  rerank: SearchRerankMeta;
  results: SearchResultItem[];
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

  const [searchQuery, setSearchQuery] = useState("");
  const [searchK, setSearchK] = useState(10);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchResponse, setSearchResponse] = useState<SearchResponse | null>(null);

  const activeConfig = configs.find((c) => c.id === activeConfigId) ?? null;

  const loadConfigs = useCallback(() => {
    setLoadingConfigs(true);
    setConfigsError(null);
    return fetch("/api/search-configs")
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
  }, []);

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
                      {activeConfig.dataset_name} · {activeConfig.vectorized_count}{" "}
                      vectorized docs
                      {activeConfig.rerank_enabled && (
                        <span className="ml-2 rounded border px-1.5 py-0.5 text-xs">
                          rerank on
                        </span>
                      )}
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
                      {searchResponse.rerank.enabled && (
                        <>
                          {" "}
                          · rerank {searchResponse.rerank.model} (
                          {searchResponse.rerank.candidate_count} candidates
                          {searchResponse.rerank.fallback_used ? ", hybrid fallback" : ""})
                        </>
                      )}
                    </p>
                    <ol className="space-y-2">
                      {searchResponse.results.map((r, idx) => (
                        <li key={r.id} className="rounded-md border p-3 text-sm">
                          <div className="mb-1 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                            <span>
                              #{idx + 1} · doc {r.document_id.slice(0, 8)}
                            </span>
                            <span className="font-mono">
                              {r.rerank_rank != null ? (
                                <>
                                  rerank {r.rerank_score?.toFixed(4)} (was #{r.original_rank}) ·
                                  hybrid {r.score.toFixed(4)}
                                </>
                              ) : (
                                <>
                                  score {r.score.toFixed(4)} · vec{" "}
                                  {r.vector_similarity.toFixed(3)} · fts {r.fts_rank.toFixed(3)}
                                </>
                              )}
                            </span>
                          </div>
                          <div className="whitespace-pre-wrap break-words">{r.snippet}</div>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
