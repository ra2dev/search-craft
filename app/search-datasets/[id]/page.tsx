"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
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
};

type DescribeResult = {
  described_count: number;
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
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [documents, setDocuments] = useState<SearchDocumentPreview[]>([]);
  const [documentsTotal, setDocumentsTotal] = useState(0);

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

  useEffect(() => {
    Promise.all([loadDetail(), loadDocuments()]).finally(() => setLoading(false));
  }, [loadDetail, loadDocuments]);

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

  const canDescribe =
    detail != null &&
    !!detail.description_prompt &&
    !!detail.description_model &&
    detail.document_count > detail.described_count;

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
                    {detail.described_count} / {detail.document_count} described
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
