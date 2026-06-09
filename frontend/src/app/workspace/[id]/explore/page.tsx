"use client";
import { useState } from "react";
import { useParams } from "next/navigation";
import useSWR from "swr";
import { api } from "@/lib/api";
import { FileTree } from "@/components/repo/FileTree";
import { ArchitectureDiagram } from "@/components/repo/ArchitectureDiagram";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, FileCode, GitBranch } from "lucide-react";

export default function WorkspaceExplorePage() {
  const params = useParams();
  const workspaceId = Number(params.id);
  const { data: ws, isLoading } = useSWR(`/workspace/${workspaceId}`, () => api.workspace.get(workspaceId), {
    refreshInterval: 3000,
    revalidateOnFocus: false,
  });
  const { data: files } = useSWR(`/files/${workspaceId}`, () => api.files.tree(workspaceId));

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--background)" }}>
        <Skeleton className="w-64 h-8" />
      </div>
    );
  }

  const isReady = ws?.status === "ready";
  const progressMap: Record<string, number> = {
    pending: 5, cloning: 15, analyzing: 30, embedding: 50,
    generating_docs: 70, building_graph: 85, ready: 100,
  };
  const progress = progressMap[ws?.status] || 0;

  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      <header className="border-b px-6 py-3 flex items-center gap-4"
              style={{ background: "var(--sidebar)", borderColor: "var(--border)" }}>
        <a href="/dashboard" style={{ color: "var(--muted-foreground)" }}>
          <ArrowLeft className="w-5 h-5" />
        </a>
        <GitBranch className="w-5 h-5" style={{ color: "var(--accent)" }} />
        <span className="font-semibold" style={{ color: "var(--foreground)" }}>
          {ws?.repo_owner}/{ws?.repo_name}
        </span>
        <Badge variant="outline" className="ml-auto" style={{ borderColor: "var(--accent)40", color: "var(--accent)" }}>
          {ws?.branch}
        </Badge>
      </header>

      {!isReady ? (
        <div className="max-w-lg mx-auto py-20 px-6">
          <h2 className="text-lg font-semibold mb-4" style={{ color: "var(--foreground)" }}>
            Analyzing Repository...
          </h2>
          <Progress value={progress} className="h-2 mb-2"
                    style={{ background: "var(--border)" }} />
          <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
            Status: {ws?.status}
          </p>
        </div>
      ) : (
        <div className="flex h-[calc(100vh-57px)]">
          <aside className="w-72 border-r overflow-auto" style={{ borderColor: "var(--border)", background: "var(--sidebar)" }}>
            <div className="p-3 border-b text-sm font-medium flex items-center gap-2"
                 style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}>
              <FileCode className="w-4 h-4" /> Explorer
            </div>
            <FileTree
              tree={files?.tree || {}}
              onFileSelect={() => {}}
            />
          </aside>

          <main className="flex-1 overflow-auto p-6">
            <Tabs defaultValue="overview">
              <TabsList style={{ background: "var(--sidebar)", borderColor: "var(--border)" }}>
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="architecture">Architecture</TabsTrigger>
                <TabsTrigger value="docs">Documentation</TabsTrigger>
                <TabsTrigger value="issues">Issues</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="mt-6 space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="rounded-lg p-4" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
                    <p className="text-xs mb-1" style={{ color: "var(--muted-foreground)" }}>Framework</p>
                    <p className="font-semibold" style={{ color: "var(--foreground)" }}>
                      {ws?.analysis?.docs_json?.framework || "N/A"}
                    </p>
                  </div>
                  <div className="rounded-lg p-4" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
                    <p className="text-xs mb-1" style={{ color: "var(--muted-foreground)" }}>Languages</p>
                    <div className="flex flex-wrap gap-1">
                      {(ws?.analysis?.docs_json?.languages || []).map((l: string) => (
                        <Badge key={l} variant="outline" className="text-xs">{l}</Badge>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-lg p-4" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
                    <p className="text-xs mb-1" style={{ color: "var(--muted-foreground)" }}>Architecture</p>
                    <p className="font-semibold" style={{ color: "var(--foreground)" }}>
                      {ws?.analysis?.docs_json?.architecture_type || "N/A"}
                    </p>
                  </div>
                  <div className="rounded-lg p-4" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
                    <p className="text-xs mb-1" style={{ color: "var(--muted-foreground)" }}>Tech Stack</p>
                    <div className="flex flex-wrap gap-1">
                      {(ws?.analysis?.tech_stack?.detected || []).map((t: string) => (
                        <Badge key={t} variant="outline" className="text-xs">{t}</Badge>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="rounded-lg p-6" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
                  <h3 className="font-semibold mb-3" style={{ color: "var(--foreground)" }}>About</h3>
                  <p style={{ color: "var(--muted-foreground)" }}>
                    {ws?.analysis?.docs_json?.overview || "No overview available."}
                  </p>
                  {ws?.analysis?.docs_json?.key_concepts && (
                    <div className="mt-4">
                      <p className="text-sm font-medium mb-2" style={{ color: "var(--muted-foreground)" }}>Key Concepts</p>
                      <ul className="list-disc list-inside space-y-1">
                        {ws.analysis.docs_json.key_concepts.map((c: string, i: number) => (
                          <li key={i} className="text-sm" style={{ color: "var(--muted-foreground)" }}>{c}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="architecture" className="mt-6">
                <ArchitectureDiagram graph={ws?.analysis?.graph_json} />
                {ws?.analysis?.docs_json?.auth_flow && (
                  <div className="mt-4 rounded-lg p-4" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
                    <h3 className="font-semibold mb-2" style={{ color: "var(--foreground)" }}>Auth Flow</h3>
                    <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>{ws.analysis.docs_json.auth_flow}</p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="docs" className="mt-6 space-y-4">
                {["main_business_logic", "api_architecture", "database_architecture", "deployment"].map((key) => {
                  const val = ws?.analysis?.docs_json?.[key];
                  if (!val) return null;
                  return (
                    <div key={key} className="rounded-lg p-4" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
                      <h3 className="font-semibold mb-2 capitalize" style={{ color: "var(--foreground)" }}>
                        {key.replace(/_/g, " ")}
                      </h3>
                      <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>{val}</p>
                    </div>
                  );
                })}
              </TabsContent>

              <TabsContent value="issues" className="mt-6">
                <a href={`/workspace/${workspaceId}/issues`}
                   className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
                   style={{ background: "var(--accent)", color: "white" }}>
                  View Issue Board
                </a>
              </TabsContent>
            </Tabs>
          </main>
        </div>
      )}
    </div>
  );
}
