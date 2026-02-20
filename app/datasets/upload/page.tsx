"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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

export default function UploadDatasetPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const successCount = searchParams.get("document_count");
  const [name, setName] = useState("");
  const [jsonText, setJsonText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("Dataset name is required");
      return;
    }
    let rows: Array<{ content: string; metadata?: Record<string, unknown> }>;
    try {
      const parsed = JSON.parse(jsonText || "[]");
      if (!Array.isArray(parsed)) throw new Error("JSON must be an array");
      rows = parsed.map((r: unknown) => {
        if (r != null && typeof r === "object" && "content" in r && typeof (r as { content: unknown }).content === "string") {
          const row = r as { content: string; metadata?: unknown };
          return {
            content: row.content,
            metadata: row.metadata != null && typeof row.metadata === "object" && !Array.isArray(row.metadata)
              ? (row.metadata as Record<string, unknown>)
              : undefined,
          };
        }
        throw new Error("Each row must have a 'content' string");
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid JSON");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/datasets/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), rows }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Upload failed");
        return;
      }
      router.push(`/datasets/upload?success=1&document_count=${data.document_count ?? 0}`);
    } catch {
      setError("Network error");
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
                  <BreadcrumbLink href="/datasets/upload">Datasets</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>Upload</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
          {successCount != null && (
            <p className="text-sm text-green-600 dark:text-green-400">
              Dataset created with {successCount} document(s).
            </p>
          )}
          <form onSubmit={handleSubmit} className="flex flex-col gap-4 max-w-2xl">
            <div className="space-y-2">
              <label htmlFor="name" className="text-sm font-medium leading-none">
                Dataset name
              </label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Emoji list"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="json" className="text-sm font-medium leading-none">
                JSON array of rows (each row: {"{ content: string, metadata?: object }"})
              </label>
              <textarea
                id="json"
                className="flex min-h-[200px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
                value={jsonText}
                onChange={(e) => setJsonText(e.target.value)}
                placeholder='[{"content": "hello"}, {"content": "world", "metadata": {"id": 1}}]'
              />
            </div>
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
            <Button type="submit" disabled={submitting}>
              {submitting ? "Uploading…" : "Upload"}
            </Button>
          </form>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
