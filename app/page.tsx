import Link from "next/link"

import { AppSidebar } from "@/components/layout/app-sidebar"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
    SidebarInset,
    SidebarProvider,
    SidebarTrigger,
} from "@/components/ui/sidebar"
import { Database, Upload } from "lucide-react"

export default function Page() {
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
                        <span className="font-medium">Search Optimizer</span>
                    </div>
                </header>
                <div className="flex flex-1 flex-col items-center justify-center gap-6 p-8">
                    <div className="text-center space-y-2">
                        <h1 className="text-2xl font-semibold">
                            Search Optimizer Platform
                        </h1>
                        <p className="text-muted-foreground max-w-md">
                            Upload datasets, configure search, describe with LLM,
                            vectorize, and validate search quality.
                        </p>
                    </div>
                    <div className="flex gap-4">
                        <Button asChild>
                            <Link href="/datasets">
                                <Database className="mr-2 size-4" />
                                All datasets
                            </Link>
                        </Button>
                        <Button asChild variant="outline">
                            <Link href="/datasets/upload">
                                <Upload className="mr-2 size-4" />
                                Upload dataset
                            </Link>
                        </Button>
                    </div>
                </div>
            </SidebarInset>
        </SidebarProvider>
    )
}
