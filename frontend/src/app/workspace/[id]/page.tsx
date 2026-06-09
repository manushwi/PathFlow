"use client";
import { useState } from "react";
import { useParams } from "next/navigation";
import useSWR from "swr";
import { api } from "@/lib/api";
import { FileTree } from "@/components/repo/FileTree";
import { ArchitectureDiagram } from "@/components/repo/ArchitectureDiagram";
import { IssueKanban } from "@/components/issues/IssueKanban";
import { IDELayout } from "@/components/ide/IDELayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, FileCode, GitBranch, Bug, Code2, BookOpen } from "lucide-react";

export default function WorkspacePage() {
  const params = useParams();
  const workspaceId = Number(params.id);
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const { data: ws, isLoading } = useSWR(`/workspace/${workspaceId}`, () => api.workspace.get(workspaceId), {
    refreshInterval: (data) => data?.status !== "ready" ? 3000 : 0,
  });
  const { data: files } = useSWR(`/files/${workspaceId}`, () => api.files.tree(workspaceId));

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center" style={{ background: "var(--background)" }}>
        <Skeleton className="w-64 h-8" />
      </div>
    );
  }

  if (ws && ws.status !== "ready") {
    const progressMap: Record<string, number> = {
      pending: 5, cloning: 15, analyzing: 30, embedding: 50,
      generating_docs: 70, building_graph: 85,
    };
    const progress = progressMap[ws.status] || 0;
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-6" style={{ background: "var(--background)" }}>
        <GitBranch className="w-12 h-12" style={{ color: "var(--accent)" }} />
        <div className="text-center">
          <h2 className="text-lg font-semibold mb-1" style={{ color: "var(--foreground)" }}>
            Analyzing Repository
          </h2>
          <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
            {ws.repo_owner}/{ws.repo_name}
          </p>
        </div>
        <div className="w-80">
          <Progress value={progress} className="h-2" style={{ background: "var(--border)" }} />
          <p className="text-xs mt-2 text-center" style={{ color: "var(--muted-foreground)" }}>
            {ws.status.replace(/_/g, " ")}
          </p>
        </div>
      </div>
    );
  }

  const isReady = ws?.status === "ready";

  return (
    <div className="h-screen flex flex-col" style={{ background: "var(--background)" }}>
      <header className="border-b px-6 py-3 flex items-center gap-4 shrink-0"
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

      <Tabs defaultValue="explain" className="flex flex-col flex-1 min-h-0">
        <div className="border-b shrink-0 px-6" style={{ borderColor: "var(--border)", background: "var(--sidebar)" }}>
          <TabsList style={{ background: "transparent", borderColor: "var(--border)" }}>
            <TabsTrigger value="explain" className="flex items-center gap-2">
              <BookOpen className="w-4 h-4" /> Explain
            </TabsTrigger>
            <TabsTrigger value="issues" className="flex items-center gap-2">
              <Bug className="w-4 h-4" /> Issues
            </TabsTrigger>
            <TabsTrigger value="code" className="flex items-center gap-2">
              <Code2 className="w-4 h-4" /> Code
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="explain" className="flex-1 min-h-0 p-0 m-0 data-[state=active]:flex">
          {isReady ? (
            <div className="flex flex-1 min-h-0">
              <aside className="w-72 border-r overflow-auto shrink-0" style={{ borderColor: "var(--border)", background: "var(--sidebar)" }}>
                <div className="p-3 border-b text-sm font-medium flex items-center gap-2"
                     style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}>
                  <FileCode className="w-4 h-4" /> Explorer
                </div>
                <FileTree
                  tree={files?.tree || {}}
                  onFileSelect={(path) => setActiveFile(path)}
                  activeFile={activeFile || undefined}
                />
              </aside>
              <main className="flex-1 overflow-auto p-6">
                <Tabs defaultValue="overview">
                  <TabsList style={{ background: "var(--sidebar)", borderColor: "var(--border)" }}>
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="architecture">Architecture</TabsTrigger>
                    <TabsTrigger value="docs">Documentation</TabsTrigger>
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
                </Tabs>
              </main>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <p style={{ color: "var(--muted-foreground)" }}>Analysis not ready yet</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="issues" className="flex-1 min-h-0 p-0 m-0 data-[state=active]:flex">
          <div className="flex-1 overflow-auto p-6">
            <IssueKanban workspaceId={workspaceId} />
          </div>
        </TabsContent>

        <TabsContent value="code" className="flex-1 min-h-0 p-0 m-0 data-[state=active]:flex">
          <IDELayout workspaceId={workspaceId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
