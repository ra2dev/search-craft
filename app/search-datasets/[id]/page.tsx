"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { Trash2 } from "lucide-react";

type SearchDatasetDetail = {
  id: string;
  dataset_id: string;
  name: string;
  description_prompt: string | null;
  description_model: string | null;
  embedding_model: string | null;
  embedding_dimension: number | null;
  status: string;
  created_at: string;
  document_count: number;
  described_count: number;
  vectorized_count: number;
};

type DescribeResult = {
  described_count: number;
  failed_count: number;
  total_pending: number;
  failures?: Array<{ id: string; error: string }>;
};

type VectorizeResult = {
  vectorized_count: number;
  failed_count: number;
  total_pending: number;
  failures?: Array<{ id: string; error: string }>;
};

type SearchDocumentPreview = {
  id: string;
  content: string;
  description: string | null;
  created_at: string;
};

type SearchDocumentsResponse = {
  total: number;
  documents: SearchDocumentPreview[];
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

type ValidationPerQuery = {
  query_id: string;
  query: string;
  max_rank: number;
  expected_document_ids: string[];
  ranks: Array<number | null>;
  best_rank: number | null;
  passed: boolean;
};

type ValidationRunResponse = {
  run_id: string;
  run_at: string;
  metrics: ValidationRunMetrics;
  per_query: ValidationPerQuery[];
};

type ValidationRunSummary = {
  id: string;
  run_at: string;
  validation_set_id: string;
  validation_set_name: string | null;
  metrics: {
    total_queries: number | null;
    pass_rate: number | null;
    recall_at_max_rank: number | null;
    mrr: number | null;
  };
};

export default function SearchDatasetDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [detail, setDetail] = useState<SearchDatasetDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [describing, setDescribing] = useState(false);
  const [describeError, setDescribeError] = useState<string | null>(null);
  const [describeResult, setDescribeResult] = useState<DescribeResult | null>(null);
  const [vectorizing, setVectorizing] = useState(false);
  const [vectorizeError, setVectorizeError] = useState<string | null>(null);
  const [vectorizeResult, setVectorizeResult] = useState<VectorizeResult | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [documents, setDocuments] = useState<SearchDocumentPreview[]>([]);
  const [documentsTotal, setDocumentsTotal] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchK, setSearchK] = useState(10);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchResponse, setSearchResponse] = useState<SearchResponse | null>(null);

  const [validationSets, setValidationSets] = useState<ValidationSetSummary[]>([]);
  const [selectedValidationSetId, setSelectedValidationSetId] = useState<string>("");
  const [runningValidation, setRunningValidation] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [validationRun, setValidationRun] = useState<ValidationRunResponse | null>(null);
  const [validationHistory, setValidationHistory] = useState<ValidationRunSummary[]>([]);

  const loadDetail = useCallback(() => {
    return fetch(`/api/search-datasets/${id}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(res.statusText))))
      .then((data: SearchDatasetDetail) => setDetail(data))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"));
  }, [id]);

  const loadDocuments = useCallback(() => {
    return fetch(`/api/search-datasets/${id}/documents`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(res.statusText))))
      .then((data: SearchDocumentsResponse) => {
        setDocuments(data.documents ?? []);
        setDocumentsTotal(data.total ?? 0);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"));
  }, [id]);

  const loadValidationHistory = useCallback(() => {
    return fetch(`/api/search-datasets/${id}/validation-runs`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data: ValidationRunSummary[]) => setValidationHistory(data ?? []))
      .catch(() => {});
  }, [id]);

  useEffect(() => {
    Promise.all([loadDetail(), loadDocuments()]).finally(() => setLoading(false));
  }, [loadDetail, loadDocuments]);

  useEffect(() => {
    loadValidationHistory();
  }, [loadValidationHistory]);

  useEffect(() => {
    if (!detail?.dataset_id) return;
    fetch(`/api/datasets/${detail.dataset_id}/validation-sets`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data: ValidationSetSummary[]) => {
        setValidationSets(data ?? []);
        setSelectedValidationSetId((prev) => {
          if (prev && data?.some((s) => s.id === prev)) return prev;
          return data?.[0]?.id ?? "";
        });
      })
      .catch(() => {});
  }, [detail?.dataset_id]);

  async function handleRunValidation(e?: React.FormEvent) {
    e?.preventDefault();
    if (!selectedValidationSetId) {
      setValidationError("Select a validation set first.");
      return;
    }
    setRunningValidation(true);
    setValidationError(null);
    setValidationRun(null);
    try {
      const res = await fetch(`/api/search-datasets/${id}/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ validation_set_id: selectedValidationSetId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setValidationError(data.error ?? "Validation failed");
        return;
      }
      setValidationRun(data as ValidationRunResponse);
      await loadValidationHistory();
    } catch {
      setValidationError("Network error");
    } finally {
      setRunningValidation(false);
    }
  }

  async function handleRunDescribe() {
    setDescribing(true);
    setDescribeError(null);
    setDescribeResult(null);
    try {
      const res = await fetch(`/api/search-datasets/${id}/describe`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setDescribeError(data.error ?? "Describe failed");
        return;
      }
      setDescribeResult(data as DescribeResult);
      await Promise.all([loadDetail(), loadDocuments()]);
    } catch {
      setDescribeError("Network error");
    } finally {
      setDescribing(false);
    }
  }

  async function handleRunVectorize() {
    setVectorizing(true);
    setVectorizeError(null);
    setVectorizeResult(null);
    try {
      const res = await fetch(`/api/search-datasets/${id}/vectorize`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setVectorizeError(data.error ?? "Vectorize failed");
        return;
      }
      setVectorizeResult(data as VectorizeResult);
      await Promise.all([loadDetail(), loadDocuments()]);
    } catch {
      setVectorizeError("Network error");
    } finally {
      setVectorizing(false);
    }
  }

  async function handleDelete() {
    if (!detail) return;
    const confirmed = window.confirm(
      `Delete search config "${detail.name}"? This will also delete its search documents and validation sets. This cannot be undone.`
    );
    if (!confirmed) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/search-datasets/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? res.statusText);
      }
      router.push(`/datasets/${detail.dataset_id}`);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Failed to delete");
      setDeleting(false);
    }
  }

  async function handleRunSearch(event?: React.FormEvent<HTMLFormElement>) {
    event?.preventDefault();
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
      const res = await fetch(`/api/search-datasets/${id}/search?${params.toString()}`);
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

  const canSearch =
    detail != null &&
    !!detail.embedding_model &&
    !!detail.embedding_dimension &&
    detail.vectorized_count > 0;

  const canDescribe =
    detail != null &&
    !!detail.description_prompt &&
    !!detail.description_model &&
    detail.document_count > detail.described_count;

  const canVectorize =
    detail != null &&
    !!detail.embedding_model &&
    !!detail.embedding_dimension &&
    detail.document_count > detail.vectorized_count;

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink href="/">Building</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbLink href="/datasets">Datasets</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                {detail && (
                  <>
                    <BreadcrumbItem>
                      <BreadcrumbLink href={`/datasets/${detail.dataset_id}`}>
                        {detail.dataset_id.slice(0, 8)}
                      </BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                  </>
                )}
                <BreadcrumbItem>
                  <BreadcrumbPage>{detail?.name ?? id}</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-6 p-4 pt-0">
          {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {error && <p className="text-sm text-destructive">{error}</p>}

          {!loading && !error && detail && (
            <>
              <section className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <h1 className="text-xl font-semibold truncate">{detail.name}</h1>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDelete}
                    disabled={deleting}
                    className="text-destructive"
                  >
                    <Trash2 className="mr-2 size-4" />
                    {deleting ? "Deleting…" : "Delete"}
                  </Button>
                </div>
                {deleteError && <p className="text-sm text-destructive">{deleteError}</p>}
                <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-sm">
                  <dt className="text-muted-foreground">Status</dt>
                  <dd>{detail.status}</dd>
                  <dt className="text-muted-foreground">Description model</dt>
                  <dd>{detail.description_model ?? <em className="text-muted-foreground">not set</em>}</dd>
                  <dt className="text-muted-foreground">Description prompt</dt>
                  <dd className="whitespace-pre-wrap">
                    {detail.description_prompt ?? <em className="text-muted-foreground">not set</em>}
                  </dd>
                  <dt className="text-muted-foreground">Embedding model</dt>
                  <dd>
                    {detail.embedding_model} · {detail.embedding_dimension}d
                  </dd>
                  <dt className="text-muted-foreground">Documents</dt>
                  <dd>
                    {detail.described_count} / {detail.document_count} described ·{" "}
                    {detail.vectorized_count} / {detail.document_count} vectorized
                  </dd>
                </dl>
              </section>

              <section className="space-y-3">
                <h2 className="text-lg font-semibold">Describe</h2>
                {!detail.description_prompt || !detail.description_model ? (
                  <p className="text-sm text-muted-foreground">
                    This search config is missing a description prompt or model, so describe cannot run.
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Runs the configured LLM on each document that doesn&apos;t yet have a description.
                  </p>
                )}
                <Button onClick={handleRunDescribe} disabled={!canDescribe || describing}>
                  {describing ? "Running describe…" : "Run describe"}
                </Button>
                {describeError && <p className="text-sm text-destructive">{describeError}</p>}
                {describeResult && (
                  <div className="text-sm">
                    <p>
                      Described {describeResult.described_count} of {describeResult.total_pending} pending
                      document(s)
                      {describeResult.failed_count > 0 ? `, ${describeResult.failed_count} failed` : ""}.
                    </p>
                    {describeResult.failures && describeResult.failures.length > 0 && (
                      <ul className="mt-2 list-disc pl-5 text-destructive">
                        {describeResult.failures.slice(0, 5).map((f) => (
                          <li key={f.id}>
                            {f.id.slice(0, 8)}: {f.error}
                          </li>
                        ))}
                        {describeResult.failures.length > 5 && (
                          <li>…and {describeResult.failures.length - 5} more</li>
                        )}
                      </ul>
                    )}
                  </div>
                )}
              </section>

              <section className="space-y-3">
                <h2 className="text-lg font-semibold">Vectorize</h2>
                {!detail.embedding_model || !detail.embedding_dimension ? (
                  <p className="text-sm text-muted-foreground">
                    This search config is missing an embedding model or dimension, so vectorize cannot run.
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Embeds content{detail.described_count > 0 ? " + description" : ""} with{" "}
                    <span className="font-mono">{detail.embedding_model}</span> at{" "}
                    {detail.embedding_dimension}d for each document that doesn&apos;t yet have an
                    embedding.
                  </p>
                )}
                <Button onClick={handleRunVectorize} disabled={!canVectorize || vectorizing}>
                  {vectorizing ? "Running vectorize…" : "Run vectorize"}
                </Button>
                {vectorizeError && <p className="text-sm text-destructive">{vectorizeError}</p>}
                {vectorizeResult && (
                  <div className="text-sm">
                    <p>
                      Vectorized {vectorizeResult.vectorized_count} of {vectorizeResult.total_pending}{" "}
                      pending document(s)
                      {vectorizeResult.failed_count > 0
                        ? `, ${vectorizeResult.failed_count} failed`
                        : ""}
                      .
                    </p>
                    {vectorizeResult.failures && vectorizeResult.failures.length > 0 && (
                      <ul className="mt-2 list-disc pl-5 text-destructive">
                        {vectorizeResult.failures.slice(0, 5).map((f) => (
                          <li key={f.id}>
                            {f.id.slice(0, 8)}: {f.error}
                          </li>
                        ))}
                        {vectorizeResult.failures.length > 5 && (
                          <li>…and {vectorizeResult.failures.length - 5} more</li>
                        )}
                      </ul>
                    )}
                  </div>
                )}
              </section>

              <section className="space-y-3">
                <h2 className="text-lg font-semibold">Search</h2>
                {!canSearch ? (
                  <p className="text-sm text-muted-foreground">
                    Vectorize at least one document before searching.
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Hybrid search: embeds your query with{" "}
                    <span className="font-mono">{detail.embedding_model}</span> and combines vector
                    similarity with full-text search using reciprocal rank fusion.
                  </p>
                )}
                <form onSubmit={handleRunSearch} className="flex flex-wrap items-center gap-2">
                  <Input
                    type="text"
                    placeholder="Type a query…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="max-w-md"
                    disabled={!canSearch || searching}
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
                      disabled={!canSearch || searching}
                    />
                  </label>
                  <Button type="submit" disabled={!canSearch || searching}>
                    {searching ? "Searching…" : "Search"}
                  </Button>
                </form>
                {searchError && <p className="text-sm text-destructive">{searchError}</p>}
                {searchResponse && (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">
                      {searchResponse.result_count === 0
                        ? "No results."
                        : `Top ${searchResponse.result_count} result${
                            searchResponse.result_count === 1 ? "" : "s"
                          } for “${searchResponse.query}”`}
                    </p>
                    {searchResponse.results.length > 0 && (
                      <ol className="space-y-2">
                        {searchResponse.results.map((r, idx) => (
                          <li
                            key={r.id}
                            className="rounded-md border p-3 text-sm"
                          >
                            <div className="mb-1 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                              <span>
                                #{idx + 1} · doc {r.document_id.slice(0, 8)}
                              </span>
                              <span className="font-mono">
                                score {r.score.toFixed(4)} · vec {r.vector_similarity.toFixed(3)} ·
                                fts {r.fts_rank.toFixed(3)}
                              </span>
                            </div>
                            <div className="whitespace-pre-wrap break-words">{r.snippet}</div>
                            {r.description && (
                              <div className="mt-2 whitespace-pre-wrap break-words text-xs text-muted-foreground">
                                {r.description}
                              </div>
                            )}
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>
                )}
              </section>

              <section className="space-y-3">
                <h2 className="text-lg font-semibold">Validation</h2>
                {!canSearch ? (
                  <p className="text-sm text-muted-foreground">
                    Vectorize at least one document before running validation.
                  </p>
                ) : validationSets.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No validation sets on the parent dataset yet.{" "}
                    {detail && (
                      <Link
                        href={`/datasets/${detail.dataset_id}`}
                        className="underline underline-offset-2"
                      >
                        Create one on the dataset page
                      </Link>
                    )}{" "}
                    first, then come back here to run it.
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Runs a validation set&apos;s queries against this search config and records
                    pass rate, recall@max_rank, and MRR.
                  </p>
                )}
                {validationSets.length > 0 && (
                  <form
                    onSubmit={handleRunValidation}
                    className="flex flex-wrap items-center gap-2"
                  >
                    <select
                      className="flex h-9 min-w-56 rounded-md border border-input bg-background px-3 py-1 text-sm"
                      value={selectedValidationSetId}
                      onChange={(e) => setSelectedValidationSetId(e.target.value)}
                      disabled={!canSearch || runningValidation}
                    >
                      {validationSets.map((vs) => (
                        <option key={vs.id} value={vs.id}>
                          {vs.name} ({vs.query_count})
                        </option>
                      ))}
                    </select>
                    <Button
                      type="submit"
                      disabled={!canSearch || !selectedValidationSetId || runningValidation}
                    >
                      {runningValidation ? "Running validation…" : "Run validation"}
                    </Button>
                    {selectedValidationSetId && (
                      <Link
                        href={`/validation-sets/${selectedValidationSetId}`}
                        className="text-xs text-muted-foreground underline underline-offset-2"
                      >
                        Edit set
                      </Link>
                    )}
                  </form>
                )}
                {validationError && (
                  <p className="text-sm text-destructive">{validationError}</p>
                )}
                {validationRun && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-md border p-3 text-sm sm:grid-cols-4">
                      <div>
                        <div className="text-xs text-muted-foreground">Queries</div>
                        <div className="font-mono">{validationRun.metrics.total_queries}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Pass rate</div>
                        <div className="font-mono">
                          {(validationRun.metrics.pass_rate * 100).toFixed(1)}%
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Recall@max_rank</div>
                        <div className="font-mono">
                          {(validationRun.metrics.recall_at_max_rank * 100).toFixed(1)}%
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">MRR</div>
                        <div className="font-mono">{validationRun.metrics.mrr.toFixed(4)}</div>
                      </div>
                    </div>
                    <div className="overflow-hidden rounded-lg border">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                          <tr>
                            <th className="px-3 py-2 text-left font-medium">Query</th>
                            <th className="px-3 py-2 text-left font-medium">Max rank</th>
                            <th className="px-3 py-2 text-left font-medium">Best rank</th>
                            <th className="px-3 py-2 text-left font-medium">Expected ranks</th>
                            <th className="px-3 py-2 text-left font-medium">Result</th>
                          </tr>
                        </thead>
                        <tbody>
                          {validationRun.per_query.map((row) => (
                            <tr key={row.query_id} className="border-t align-top">
                              <td className="px-3 py-2 font-medium">{row.query}</td>
                              <td className="px-3 py-2 font-mono">{row.max_rank}</td>
                              <td className="px-3 py-2 font-mono">
                                {row.best_rank ?? "—"}
                              </td>
                              <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                                {row.ranks.length === 0
                                  ? "—"
                                  : row.ranks.map((r) => r ?? "∞").join(", ")}
                              </td>
                              <td className="px-3 py-2">
                                {row.passed ? (
                                  <span className="text-green-700">pass</span>
                                ) : (
                                  <span className="text-destructive">fail</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
                {validationHistory.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-medium">Prior runs</h3>
                    <div className="overflow-hidden rounded-lg border">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                          <tr>
                            <th className="px-3 py-2 text-left font-medium">When</th>
                            <th className="px-3 py-2 text-left font-medium">Set</th>
                            <th className="px-3 py-2 text-left font-medium">Queries</th>
                            <th className="px-3 py-2 text-left font-medium">Pass rate</th>
                            <th className="px-3 py-2 text-left font-medium">Recall</th>
                            <th className="px-3 py-2 text-left font-medium">MRR</th>
                          </tr>
                        </thead>
                        <tbody>
                          {validationHistory.map((run) => (
                            <tr key={run.id} className="border-t align-top">
                              <td className="px-3 py-2 text-xs text-muted-foreground">
                                {new Date(run.run_at).toLocaleString()}
                              </td>
                              <td className="px-3 py-2">
                                {run.validation_set_name ?? (
                                  <span className="italic text-muted-foreground">deleted</span>
                                )}
                              </td>
                              <td className="px-3 py-2 font-mono">
                                {run.metrics.total_queries ?? "—"}
                              </td>
                              <td className="px-3 py-2 font-mono">
                                {run.metrics.pass_rate != null
                                  ? `${(run.metrics.pass_rate * 100).toFixed(1)}%`
                                  : "—"}
                              </td>
                              <td className="px-3 py-2 font-mono">
                                {run.metrics.recall_at_max_rank != null
                                  ? `${(run.metrics.recall_at_max_rank * 100).toFixed(1)}%`
                                  : "—"}
                              </td>
                              <td className="px-3 py-2 font-mono">
                                {run.metrics.mrr != null ? run.metrics.mrr.toFixed(4) : "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </section>

              <section>
                <div className="mb-3 flex items-baseline justify-between">
                  <h2 className="text-lg font-semibold">Documents</h2>
                  <span className="text-xs text-muted-foreground">
                    {documentsTotal === 0
                      ? "No documents"
                      : `${documentsTotal.toLocaleString()} total`}
                  </span>
                </div>
                {documents.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No documents in this search config.</p>
                ) : (
                  <div className="overflow-hidden rounded-lg border">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium w-1/2">Content</th>
                          <th className="px-3 py-2 text-left font-medium w-1/2">Description</th>
                        </tr>
                      </thead>
                      <tbody>
                        {documents.map((doc) => (
                          <tr key={doc.id} className="border-t align-top">
                            <td className="px-3 py-2">
                              <span className="whitespace-pre-wrap break-words">{doc.content}</span>
                            </td>
                            <td className="px-3 py-2">
                              {doc.description ? (
                                <span className="whitespace-pre-wrap break-words">{doc.description}</span>
                              ) : (
                                <span className="text-xs italic text-muted-foreground">
                                  not described yet
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
