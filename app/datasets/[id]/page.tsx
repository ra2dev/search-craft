"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
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

const DIMENSIONS = [384, 768, 1536, 3072] as const;

export default function DatasetDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [datasetName, setDatasetName] = useState<string | null>(null);
  const [searchDatasets, setSearchDatasets] = useState<SearchDataset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [formName, setFormName] = useState("");
  const [formPrompt, setFormPrompt] = useState("");
  const [formDescModel, setFormDescModel] = useState("");
  const [formEmbedModel, setFormEmbedModel] = useState("");
  const [formDimension, setFormDimension] = useState<number>(1536);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchSearchDatasets = useCallback(() => {
    fetch(`/api/datasets/${id}/search-datasets`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(res.statusText))))
      .then((data: SearchDataset[]) => setSearchDatasets(data))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"));
  }, [id]);

  useEffect(() => {
    Promise.all([
      fetch("/api/datasets").then((res) => res.json()),
      fetch(`/api/datasets/${id}/search-datasets`).then((res) => (res.ok ? res.json() : [])),
    ])
      .then(([datasets, searchConfigs]: [Array<{ id: string; name: string }>, SearchDataset[]]) => {
        const ds = datasets.find((d: { id: string }) => d.id === id);
        setDatasetName(ds?.name ?? id);
        setSearchDatasets(searchConfigs);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [id]);

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
              <section>
                <h2 className="text-lg font-semibold mb-3">Search configs</h2>
                {searchDatasets.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No search configs yet. Create one below.</p>
                ) : (
                  <ul className="space-y-2">
                    {searchDatasets.map((sd) => (
                      <li key={sd.id}>
                        <Link
                          href={`/search-datasets/${sd.id}`}
                          className="block rounded-lg border p-3 hover:bg-muted/50"
                        >
                          <span className="font-medium">{sd.name}</span>
                          <span className="ml-2 text-xs text-muted-foreground">
                            {sd.embedding_model} · {sd.embedding_dimension}d · {sd.status}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section>
                <h2 className="text-lg font-semibold mb-3">Create search config</h2>
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
                    <Input
                      id="prompt"
                      value={formPrompt}
                      onChange={(e) => setFormPrompt(e.target.value)}
                      placeholder="Optional"
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
              </section>
            </>
          )}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
