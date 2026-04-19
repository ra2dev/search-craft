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

type ValidationQuery = {
  id: string;
  query: string;
  expected_document_ids: string[];
  max_rank: number;
  created_at: string;
};

type ValidationSetDetail = {
  id: string;
  name: string;
  dataset_id: string;
  created_at: string;
  queries: ValidationQuery[];
};

const SAMPLE_JSON = `[
  { "query": "cake",  "expected_document_ids": ["<uuid>"], "max_rank": 10 },
  { "query": "heart", "expected_document_ids": ["<uuid>"], "max_rank": 1 }
]`;

export default function ValidationSetPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [detail, setDetail] = useState<ValidationSetDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [jsonInput, setJsonInput] = useState("");
  const [mode, setMode] = useState<"append" | "replace">("append");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadResult, setUploadResult] = useState<string | null>(null);

  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const loadDetail = useCallback(() => {
    return fetch(`/api/validation-sets/${id}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(res.statusText))))
      .then((data: ValidationSetDetail) => setDetail(data))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"));
  }, [id]);

  useEffect(() => {
    loadDetail().finally(() => setLoading(false));
  }, [loadDetail]);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    setUploadError(null);
    setUploadResult(null);
    const raw = jsonInput.trim();
    if (!raw) {
      setUploadError("Paste a JSON array of queries first.");
      return;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      setUploadError(`Invalid JSON: ${err instanceof Error ? err.message : String(err)}`);
      return;
    }
    if (!Array.isArray(parsed)) {
      setUploadError("JSON must be an array of query objects.");
      return;
    }
    setUploading(true);
    try {
      const res = await fetch(`/api/validation-sets/${id}/queries`, {
        method: mode === "replace" ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setUploadError(data.error ?? "Upload failed");
        return;
      }
      setUploadResult(
        `${mode === "replace" ? "Replaced with" : "Added"} ${data.inserted_count ?? 0} queries.`
      );
      setJsonInput("");
      await loadDetail();
    } catch {
      setUploadError("Network error");
    } finally {
      setUploading(false);
    }
  }

  async function handleDeleteSet() {
    if (!detail) return;
    const confirmed = window.confirm(
      `Delete validation set "${detail.name}"? This deletes all its queries and prior runs.`
    );
    if (!confirmed) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/validation-sets/${id}`, { method: "DELETE" });
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
              <section className="flex items-center justify-between gap-3">
                <div>
                  <h1 className="text-xl font-semibold">{detail.name}</h1>
                  <p className="text-xs text-muted-foreground">
                    {detail.queries.length}{" "}
                    {detail.queries.length === 1 ? "query" : "queries"}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDeleteSet}
                  disabled={deleting}
                  className="text-destructive"
                >
                  <Trash2 className="mr-2 size-4" />
                  {deleting ? "Deleting…" : "Delete set"}
                </Button>
              </section>
              {deleteError && <p className="text-sm text-destructive">{deleteError}</p>}

              <section className="space-y-3">
                <h2 className="text-lg font-semibold">Queries</h2>
                {detail.queries.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No queries yet. Paste a JSON array below to add some.
                  </p>
                ) : (
                  <div className="overflow-hidden rounded-lg border">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium">Query</th>
                          <th className="px-3 py-2 text-left font-medium">Expected docs</th>
                          <th className="px-3 py-2 text-left font-medium">Max rank</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detail.queries.map((q) => (
                          <tr key={q.id} className="border-t align-top">
                            <td className="px-3 py-2 font-medium">{q.query}</td>
                            <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                              {q.expected_document_ids.length === 0
                                ? "—"
                                : q.expected_document_ids
                                    .map((d) => d.slice(0, 8))
                                    .join(", ")}
                            </td>
                            <td className="px-3 py-2">{q.max_rank}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              <section className="space-y-3">
                <h2 className="text-lg font-semibold">Upload queries (JSON)</h2>
                <p className="text-sm text-muted-foreground">
                  Paste an array of{" "}
                  <span className="font-mono">
                    {"{ query, expected_document_ids, max_rank? }"}
                  </span>{" "}
                  objects. <span className="font-mono">max_rank</span> defaults to 10.
                </p>
                <form onSubmit={handleUpload} className="space-y-3">
                  <textarea
                    value={jsonInput}
                    onChange={(e) => setJsonInput(e.target.value)}
                    placeholder={SAMPLE_JSON}
                    rows={10}
                    className="flex w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs shadow-xs placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={uploading}
                  />
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name="mode"
                        checked={mode === "append"}
                        onChange={() => setMode("append")}
                      />
                      Append
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name="mode"
                        checked={mode === "replace"}
                        onChange={() => setMode("replace")}
                      />
                      Replace all
                    </label>
                    <Button type="submit" size="sm" disabled={uploading}>
                      {uploading ? "Uploading…" : "Upload"}
                    </Button>
                  </div>
                </form>
                {uploadError && <p className="text-sm text-destructive">{uploadError}</p>}
                {uploadResult && <p className="text-sm text-green-700">{uploadResult}</p>}
              </section>
            </>
          )}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
