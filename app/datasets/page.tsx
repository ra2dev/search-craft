"use client";

import { useEffect, useState } from "react";
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
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { Trash2 } from "lucide-react";

type Dataset = { id: string; name: string; created_at: string };

export default function DatasetsListPage() {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/datasets")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(res.statusText))))
      .then(setDatasets)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  async function handleDelete(dataset: Dataset) {
    const confirmed = window.confirm(
      `Delete dataset "${dataset.name}"? This will also delete all its documents, search configs, and validation sets. This cannot be undone.`
    );
    if (!confirmed) return;
    setDeletingId(dataset.id);
    setError(null);
    try {
      const res = await fetch(`/api/datasets/${dataset.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? res.statusText);
      }
      setDatasets((prev) => prev.filter((d) => d.id !== dataset.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setDeletingId(null);
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
                  <BreadcrumbPage>Datasets</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-semibold">Datasets</h1>
            <Button asChild>
              <Link href="/datasets/upload">Upload</Link>
            </Button>
          </div>
          {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {error && <p className="text-sm text-destructive">{error}</p>}
          {!loading && !error && (
            <ul className="space-y-2">
              {datasets.length === 0 ? (
                <p className="text-sm text-muted-foreground">No datasets yet. Upload one to get started.</p>
              ) : (
                datasets.map((d) => (
                  <li key={d.id}>
                    <div className="flex items-center gap-2 rounded-lg border p-3 hover:bg-muted/50">
                      <Link href={`/datasets/${d.id}`} className="flex-1 min-w-0">
                        <span className="font-medium">{d.name}</span>
                        <span className="ml-2 text-xs text-muted-foreground">{d.id}</span>
                      </Link>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Delete dataset ${d.name}`}
                        disabled={deletingId === d.id}
                        onClick={() => handleDelete(d)}
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </div>
                  </li>
                ))
              )}
            </ul>
          )}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
