"use client";
import { useState } from "react";
import { useParams } from "next/navigation";
import useSWR from "swr";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { ErrorBoundary } from "@/components/layout/ErrorBoundary";
import { TopBar } from "@/components/layout/TopBar";
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
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { data: ws, isLoading } = useSWR(isAuthenticated ? `/workspace/${workspaceId}` : null, () => api.workspace.get(workspaceId), {
    refreshInterval: (data) => {
      if (!data) return 3000;
      if (data.status === "ready" || data.status === "error") return 0;
      return 3000;
    },
    revalidateOnFocus: false,
  });
  const { data: files } = useSWR(isAuthenticated ? `/files/${workspaceId}` : null, () => api.files.tree(workspaceId));

  if (authLoading || isLoading) {
    return (
      <div className="h-screen flex items-center justify-center" style={{ background: "var(--background)" }}>
        <Skeleton className="w-64 h-8" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-4" style={{ background: "var(--background)" }}>
        <p style={{ color: "var(--muted-foreground)" }}>Please sign in to access this workspace.</p>
        <a href={`${process.env.NEXT_PUBLIC_API_URL}/api/auth/github`}
           className="px-6 py-3 rounded-lg text-white font-medium"
           style={{ background: "var(--accent)" }}>
          Sign In with GitHub
        </a>
      </div>
    );
  }

  if (ws && ws.status === "error") {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-6" style={{ background: "var(--background)" }}>
        <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: "#501313" }}>
          <span className="text-2xl text-[#F7C1C1]">!</span>
        </div>
        <div className="text-center">
          <h2 className="text-lg font-semibold mb-1" style={{ color: "var(--foreground)" }}>
            Analysis Failed
          </h2>
          <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
            {ws.repo_owner}/{ws.repo_name}
          </p>
          <p className="text-xs mt-2" style={{ color: "var(--muted-foreground)" }}>
            The analysis pipeline encountered an error. Make sure the Celery worker is running.
          </p>
        </div>
        <a href="/dashboard"
           className="px-6 py-3 rounded-lg text-white font-medium text-sm"
           style={{ background: "var(--accent)" }}>
          Back to Dashboard
        </a>
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
    <ErrorBoundary>
    <div className="h-screen flex flex-col" style={{ background: "var(--background)" }}>
      <TopBar
        workspaceName={ws ? `${ws.repo_owner}/${ws.repo_name}` : undefined}
        branch={ws?.branch}
        showBack
      />

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
          <IDELayout workspaceId={workspaceId} activeIssueNumber={ws?.active_issue_number ?? undefined} />
        </TabsContent>
      </Tabs>
    </div>
    </ErrorBoundary>
  );
}
