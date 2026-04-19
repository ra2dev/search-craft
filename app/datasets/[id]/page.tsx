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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { ChevronRight, Trash2 } from "lucide-react";

type SearchDataset = {
  id: string;
  name: string;
  description_prompt: string | null;
  description_model: string | null;
  embedding_model: string | null;
  embedding_dimension: number | null;
  status: string;
  created_at: string;
};

type DocumentPreview = {
  id: string;
  content: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

type DocumentsResponse = {
  total: number;
  documents: DocumentPreview[];
};

type ValidationSetSummary = {
  id: string;
  name: string;
  created_at: string;
  query_count: number;
};

const PREVIEW_LIMIT = 20;

const DIMENSIONS = [384, 768, 1536, 3072] as const;

export default function DatasetDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [datasetName, setDatasetName] = useState<string | null>(null);
  const [searchDatasets, setSearchDatasets] = useState<SearchDataset[]>([]);
  const [documents, setDocuments] = useState<DocumentPreview[]>([]);
  const [documentsTotal, setDocumentsTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [deletingDataset, setDeletingDataset] = useState(false);
  const [deletingSearchId, setDeletingSearchId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [validationSets, setValidationSets] = useState<ValidationSetSummary[]>([]);
  const [newValidationName, setNewValidationName] = useState("");
  const [creatingValidationSet, setCreatingValidationSet] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const [formName, setFormName] = useState("Emoji search");
  const [formPrompt, setFormPrompt] = useState(
    "You are given an emoji and its unicode name. Write a concise, search-friendly description (1-2 sentences) covering the emoji's common meanings, feelings, contexts, and synonyms people might type when searching for it. Do not repeat the unicode name verbatim; expand on it."
  );
  const [formDescModel, setFormDescModel] = useState("gpt-4o-mini");
  const [formEmbedModel, setFormEmbedModel] = useState("text-embedding-3-small");
  const [formDimension, setFormDimension] = useState<number>(1536);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchSearchDatasets = useCallback(() => {
    fetch(`/api/datasets/${id}/search-datasets`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(res.statusText))))
      .then((data: SearchDataset[]) => setSearchDatasets(data))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"));
  }, [id]);

  const fetchValidationSets = useCallback(() => {
    fetch(`/api/datasets/${id}/validation-sets`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(res.statusText))))
      .then((data: ValidationSetSummary[]) => setValidationSets(data))
      .catch((err) => setValidationError(err instanceof Error ? err.message : "Failed to load"));
  }, [id]);

  useEffect(() => {
    Promise.all([
      fetch("/api/datasets").then((res) => res.json()),
      fetch(`/api/datasets/${id}/search-datasets`).then((res) => (res.ok ? res.json() : [])),
      fetch(`/api/datasets/${id}/documents?limit=${PREVIEW_LIMIT}`).then((res) =>
        res.ok ? res.json() : { total: 0, documents: [] }
      ),
      fetch(`/api/datasets/${id}/validation-sets`).then((res) => (res.ok ? res.json() : [])),
    ])
      .then(
        ([datasets, searchConfigs, docsResponse, validationList]: [
          Array<{ id: string; name: string }>,
          SearchDataset[],
          DocumentsResponse,
          ValidationSetSummary[],
        ]) => {
          const ds = datasets.find((d: { id: string }) => d.id === id);
          setDatasetName(ds?.name ?? id);
          setSearchDatasets(searchConfigs);
          setDocuments(docsResponse.documents ?? []);
          setDocumentsTotal(docsResponse.total ?? 0);
          setValidationSets(validationList ?? []);
        }
      )
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleCreateValidationSet(e: React.FormEvent) {
    e.preventDefault();
    const name = newValidationName.trim();
    if (!name) {
      setValidationError("Name is required");
      return;
    }
    setCreatingValidationSet(true);
    setValidationError(null);
    try {
      const res = await fetch(`/api/datasets/${id}/validation-sets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setValidationError(data.error ?? "Failed to create validation set");
        return;
      }
      setNewValidationName("");
      fetchValidationSets();
    } catch {
      setValidationError("Network error");
    } finally {
      setCreatingValidationSet(false);
    }
  }

  async function handleDeleteDataset() {
    const confirmed = window.confirm(
      `Delete dataset "${datasetName ?? id}"? This will also delete its documents, search configs, and validation sets. This cannot be undone.`
    );
    if (!confirmed) return;
    setDeletingDataset(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/datasets/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? res.statusText);
      }
      router.push("/datasets");
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Failed to delete");
      setDeletingDataset(false);
    }
  }

  async function handleDeleteSearchDataset(sd: SearchDataset) {
    const confirmed = window.confirm(
      `Delete search config "${sd.name}"? This will also delete its search documents and validation sets. This cannot be undone.`
    );
    if (!confirmed) return;
    setDeletingSearchId(sd.id);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/search-datasets/${sd.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? res.statusText);
      }
      setSearchDatasets((prev) => prev.filter((s) => s.id !== sd.id));
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setDeletingSearchId(null);
    }
  }

  async function handleCreateSearchConfig(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!formName.trim()) {
      setFormError("Name is required");
      return;
    }
    if (!formEmbedModel.trim()) {
      setFormError("Embedding model is required");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/datasets/${id}/search-datasets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName.trim(),
          description_prompt: formPrompt.trim() || undefined,
          description_model: formDescModel.trim() || undefined,
          embedding_model: formEmbedModel.trim(),
          embedding_dimension: formDimension,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFormError(data.error ?? "Failed to create");
        return;
      }
      setFormName("");
      setFormPrompt("");
      setFormDescModel("");
      setFormEmbedModel("");
      setFormDimension(1536);
      fetchSearchDatasets();
    } catch {
      setFormError("Network error");
    } finally {
      setSubmitting(false);
    }
  }

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
                <BreadcrumbItem>
                  <BreadcrumbPage>{datasetName ?? id}</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-6 p-4 pt-0">
          {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {error && <p className="text-sm text-destructive">{error}</p>}

          {!loading && !error && (
            <>
              <section className="flex items-center justify-between gap-3">
                <h1 className="text-xl font-semibold truncate">{datasetName ?? id}</h1>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDeleteDataset}
                  disabled={deletingDataset}
                  className="text-destructive"
                >
                  <Trash2 className="mr-2 size-4" />
                  {deletingDataset ? "Deleting…" : "Delete dataset"}
                </Button>
              </section>
              {deleteError && <p className="text-sm text-destructive">{deleteError}</p>}

              <section>
                <div className="mb-3 flex items-baseline justify-between">
                  <h2 className="text-lg font-semibold">Data</h2>
                  <span className="text-xs text-muted-foreground">
                    {documentsTotal === 0
                      ? "No documents"
                      : `Showing ${documents.length} of ${documentsTotal.toLocaleString()}`}
                  </span>
                </div>
                {documents.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No documents in this dataset.</p>
                ) : (
                  <div className="overflow-hidden rounded-lg border">
                    <div className="max-h-80 overflow-auto">
                      <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-muted/50 text-xs uppercase text-muted-foreground">
                          <tr>
                            <th className="px-3 py-2 text-left font-medium">Content</th>
                            <th className="px-3 py-2 text-left font-medium">Metadata</th>
                          </tr>
                        </thead>
                        <tbody>
                          {documents.map((doc) => (
                            <tr key={doc.id} className="border-t align-top">
                              <td className="max-w-md px-3 py-2">
                                <span className="line-clamp-3 whitespace-pre-wrap break-words">
                                  {doc.content}
                                </span>
                              </td>
                              <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                                {doc.metadata && Object.keys(doc.metadata).length > 0
                                  ? JSON.stringify(doc.metadata)
                                  : "—"}
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
                <h2 className="text-lg font-semibold mb-3">Search configs</h2>
                {searchDatasets.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No search configs yet. Create one below.</p>
                ) : (
                  <ul className="space-y-2">
                    {searchDatasets.map((sd) => (
                      <li key={sd.id}>
                        <div className="flex items-center gap-2 rounded-lg border p-3 hover:bg-muted/50">
                          <Link
                            href={`/search-datasets/${sd.id}`}
                            className="flex-1 min-w-0"
                          >
                            <span className="font-medium">{sd.name}</span>
                            <span className="ml-2 text-xs text-muted-foreground">
                              {sd.embedding_model} · {sd.embedding_dimension}d · {sd.status}
                            </span>
                          </Link>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Delete search config ${sd.name}`}
                            disabled={deletingSearchId === sd.id}
                            onClick={() => handleDeleteSearchDataset(sd)}
                          >
                            <Trash2 className="size-4 text-destructive" />
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section>
                <h2 className="text-lg font-semibold mb-3">Validation sets</h2>
                {validationSets.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No validation sets yet. Create one below, then open it to add queries.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {validationSets.map((vs) => (
                      <li key={vs.id}>
                        <Link
                          href={`/validation-sets/${vs.id}`}
                          className="flex items-center gap-2 rounded-lg border p-3 hover:bg-muted/50"
                        >
                          <span className="font-medium">{vs.name}</span>
                          <span className="ml-2 text-xs text-muted-foreground">
                            {vs.query_count} {vs.query_count === 1 ? "query" : "queries"}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
                <form
                  onSubmit={handleCreateValidationSet}
                  className="mt-3 flex flex-wrap items-center gap-2"
                >
                  <Input
                    value={newValidationName}
                    onChange={(e) => setNewValidationName(e.target.value)}
                    placeholder="Validation set name (e.g. smoke tests)"
                    className="max-w-xs"
                    disabled={creatingValidationSet}
                  />
                  <Button type="submit" size="sm" disabled={creatingValidationSet}>
                    {creatingValidationSet ? "Creating…" : "Create set"}
                  </Button>
                </form>
                {validationError && (
                  <p className="mt-2 text-sm text-destructive">{validationError}</p>
                )}
              </section>

              <Collapsible open={createOpen} onOpenChange={setCreateOpen} asChild>
                <section>
                  <CollapsibleTrigger className="group flex w-full items-center gap-2 text-left">
                    <ChevronRight className="h-4 w-4 transition-transform group-data-[state=open]:rotate-90" />
                    <h2 className="text-lg font-semibold">Create search config</h2>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-3">
                    <form onSubmit={handleCreateSearchConfig} className="flex flex-col gap-3 max-w-md">
                      <div className="space-y-1">
                        <label htmlFor="name" className="text-sm font-medium">Name</label>
                        <Input
                          id="name"
                          value={formName}
                          onChange={(e) => setFormName(e.target.value)}
                          placeholder="e.g. Emoji GPT-4"
                        />
                      </div>
                      <div className="space-y-1">
                        <label htmlFor="prompt" className="text-sm font-medium">Description prompt</label>
                        <textarea
                          id="prompt"
                          value={formPrompt}
                          onChange={(e) => setFormPrompt(e.target.value)}
                          placeholder="Optional"
                          rows={4}
                          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                        />
                      </div>
                      <div className="space-y-1">
                        <label htmlFor="descModel" className="text-sm font-medium">Description model</label>
                        <Input
                          id="descModel"
                          value={formDescModel}
                          onChange={(e) => setFormDescModel(e.target.value)}
                          placeholder="e.g. gpt-4o-mini"
                        />
                      </div>
                      <div className="space-y-1">
                        <label htmlFor="embedModel" className="text-sm font-medium">Embedding model</label>
                        <Input
                          id="embedModel"
                          value={formEmbedModel}
                          onChange={(e) => setFormEmbedModel(e.target.value)}
                          placeholder="e.g. text-embedding-3-small"
                        />
                      </div>
                      <div className="space-y-1">
                        <label htmlFor="dimension" className="text-sm font-medium">Embedding dimension</label>
                        <select
                          id="dimension"
                          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                          value={formDimension}
                          onChange={(e) => setFormDimension(Number(e.target.value))}
                        >
                          {DIMENSIONS.map((d) => (
                            <option key={d} value={d}>{d}</option>
                          ))}
                        </select>
                      </div>
                      {formError && <p className="text-sm text-destructive">{formError}</p>}
                      <Button type="submit" disabled={submitting}>
                        {submitting ? "Creating…" : "Create search config"}
                      </Button>
                    </form>
                  </CollapsibleContent>
                </section>
              </Collapsible>
            </>
          )}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
