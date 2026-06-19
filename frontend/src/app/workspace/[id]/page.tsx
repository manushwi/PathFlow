"use client";
import { useState, useCallback, useEffect } from "react";
import { useParams, useSearchParams } from "next/navigation";
import useSWR from "swr";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { ErrorBoundary } from "@/components/layout/ErrorBoundary";
import { TopBar } from "@/components/layout/TopBar";
import { FileTree } from "@/components/repo/FileTree";
import { ArchitectureDiagram } from "@/components/repo/ArchitectureDiagram";
import { IssueKanban } from "@/components/issues/IssueKanban";
import { IDELayout } from "@/components/ide/IDELayout";
import { AIAssistantPanel } from "@/components/ide/AIAssistantPanel";
import { GitPanel } from "@/components/ide/GitPanel";
import { TerminalPanel } from "@/components/terminal/Terminal";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, FileCode, GitBranch, Bug, Code2, BookOpen, Bot, RotateCcw, Terminal as TerminalIcon } from "lucide-react";

export default function WorkspacePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const workspaceId = Number(params.id);
  const tabFromUrl = searchParams.get("tab") || "explain";
  const [activeTab, setActiveTab] = useState(tabFromUrl);
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState("");
  const [editedContent, setEditedContent] = useState("");
  const [loadingFile, setLoadingFile] = useState(false);
  const [reanalyzing, setReanalyzing] = useState(false);
  const [rightPanel, setRightPanel] = useState<"ai" | "git">("ai");
  const [audience, setAudience] = useState<"beginner" | "professional">("beginner");
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { data: ws, isLoading } = useSWR(isAuthenticated ? `/workspace/${workspaceId}` : null, () => api.workspace.get(workspaceId), {
    refreshInterval: (data) => {
      if (!data) return 3000;
      if (data.status === "ready" || data.status === "error") return 0;
      return 3000;
    },
    revalidateOnFocus: false,
  });
  const isReady = ws?.status === "ready";
  const { data: files, mutate: refreshFiles } = useSWR(isAuthenticated && isReady ? `/files/${workspaceId}` : null, () => api.files.tree(workspaceId));

  const handleFileSelect = useCallback(async (path: string) => {
    setActiveFile(path);
    setLoadingFile(true);
    try {
      const res = await api.files.content(workspaceId, path);
      setFileContent(res.content);
      setEditedContent(res.content);
    } catch {
      setFileContent("// Could not load file");
      setEditedContent("// Could not load file");
    } finally {
      setLoadingFile(false);
    }
  }, [workspaceId]);

  const handleEditorChange = useCallback((value: string | undefined) => {
    if (value !== undefined) setEditedContent(value);
  }, []);

  const handleCreate = useCallback(async (path: string, type: "file" | "folder") => {
    try {
      await api.files.create(workspaceId, path, type);
      refreshFiles();
      if (type === "file") {
        handleFileSelect(path);
      }
    } catch (e: any) {
      console.error("Create failed", e);
    }
  }, [workspaceId, refreshFiles, handleFileSelect]);

  const handleSaveCurrentFile = useCallback(async () => {
    if (activeFile && editedContent) {
      await api.files.save(workspaceId, activeFile, editedContent);
    }
  }, [activeFile, editedContent, workspaceId]);

  const handleDelete = useCallback(async (path: string) => {
    try {
      await api.files.delete(workspaceId, path);
      if (activeFile === path) {
        setActiveFile(null);
        setFileContent("");
        setEditedContent("");
      }
      refreshFiles();
    } catch (e: any) {
      console.error("Delete failed", e);
    }
  }, [workspaceId, activeFile, refreshFiles]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (activeFile && editedContent) {
          api.files.save(workspaceId, activeFile, editedContent)
            .then(() => {}).catch(() => {});
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeFile, editedContent, workspaceId]);

  useEffect(() => {
    const saveOpenFiles = () => {
      if (activeFile) {
        api.files.saveOpenFiles(workspaceId, [{ path: activeFile, line: 0, col: 0 }])
          .catch(() => {});
      }
    };
    window.addEventListener('beforeunload', saveOpenFiles);
    return () => window.removeEventListener('beforeunload', saveOpenFiles);
  }, [activeFile, workspaceId]);

  useEffect(() => {
    api.files.getOpenFiles(workspaceId).then((res) => {
      if (res.files?.length > 0) {
        const lastFile = res.files[res.files.length - 1];
        handleFileSelect(lastFile.path);
      }
    }).catch(() => {});
  }, [workspaceId]);

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

  const handleReanalyze = async () => {
    setReanalyzing(true);
    try {
      await api.workspace.reanalyze(workspaceId);
    } catch (e: any) {
      console.error("Re-analysis failed", e);
    } finally {
      setReanalyzing(false);
    }
  };

  return (
    <ErrorBoundary>
    <div className="h-screen flex flex-col" style={{ background: "var(--background)" }}>
      <TopBar
        workspaceName={ws ? `${ws.repo_owner}/${ws.repo_name}` : undefined}
        branch={ws?.branch}
        showBack
      />

      <ResizablePanelGroup orientation="horizontal" className="flex-1 min-h-0">
        <ResizablePanel defaultSize={20}>
          <div className="h-full flex flex-col" style={{ background: "var(--sidebar)" }}>
            <div className="p-3 border-b text-sm font-medium flex items-center gap-2"
                 style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}>
              <FileCode className="w-4 h-4" /> Explorer
            </div>
            <div className="flex-1 overflow-auto">
              <FileTree
                tree={files?.tree || {}}
                onFileSelect={handleFileSelect}
                activeFile={activeFile || undefined}
                onCreate={handleCreate}
                onDelete={handleDelete}
              />
            </div>
          </div>
        </ResizablePanel>

        <ResizableHandle style={{ background: "var(--border)" }} />

        <ResizablePanel defaultSize={55}>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full">
            <div className="border-b shrink-0 px-6 flex items-center justify-between" style={{ borderColor: "var(--border)", background: "var(--sidebar)" }}>
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
                <TabsTrigger value="terminal" className="flex items-center gap-2">
                  <TerminalIcon className="w-4 h-4" /> Terminal
                </TabsTrigger>
              </TabsList>
              {isReady && (
                <button
                  onClick={handleReanalyze}
                  disabled={reanalyzing}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                  style={{
                    color: "var(--muted-foreground)",
                    border: "1px solid var(--border)",
                    background: "transparent",
                  }}
                >
                  <RotateCcw className={`w-3.5 h-3.5 ${reanalyzing ? "animate-spin" : ""}`} />
                  {reanalyzing ? "Re-analyzing..." : "Refresh analysis"}
                </button>
              )}
            </div>

            <TabsContent value="explain" className="flex-1 min-h-0 p-0 m-0 data-[state=active]:flex">
              {isReady ? (
                <main className="flex-1 overflow-auto p-6">
                  <Tabs defaultValue="overview">
                    <TabsList style={{ background: "var(--sidebar)", borderColor: "var(--border)" }}>
                      <TabsTrigger value="overview">Overview</TabsTrigger>
                      <TabsTrigger value="architecture">Architecture</TabsTrigger>
                      <TabsTrigger value="docs">Documentation</TabsTrigger>
                    </TabsList>
                    <TabsContent value="overview" className="mt-6 space-y-6">
                      <div className="flex gap-2 mb-2">
                        <button
                          onClick={() => setAudience("beginner")}
                          className="px-4 py-1.5 rounded-lg text-xs font-medium transition-colors"
                          style={{
                            background: audience === "beginner" ? "var(--accent)" : "var(--sidebar)",
                            color: audience === "beginner" ? "white" : "var(--muted-foreground)",
                            border: "1px solid var(--border)",
                          }}
                        >
                          Beginner
                        </button>
                        <button
                          onClick={() => setAudience("professional")}
                          className="px-4 py-1.5 rounded-lg text-xs font-medium transition-colors"
                          style={{
                            background: audience === "professional" ? "var(--accent)" : "var(--sidebar)",
                            color: audience === "professional" ? "white" : "var(--muted-foreground)",
                            border: "1px solid var(--border)",
                          }}
                        >
                          Professional
                        </button>
                      </div>

                      {audience === "beginner" ? (
                        <>
                          <div className="rounded-lg p-6" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
                            <h3 className="font-semibold mb-3" style={{ color: "var(--foreground)" }}>Overview</h3>
                            <p style={{ color: "var(--muted-foreground)" }}>
                              {ws?.analysis?.docs_json?.overview || "No overview available."}
                            </p>
                          </div>
                          {ws?.analysis?.docs_json?.beginner_explanation && (
                            <div className="rounded-lg p-6" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
                              <h3 className="font-semibold mb-3" style={{ color: "var(--foreground)" }}>Explanation for Beginners</h3>
                              <p style={{ color: "var(--muted-foreground)" }}>
                                {ws.analysis.docs_json.beginner_explanation}
                              </p>
                            </div>
                          )}
                          {ws?.analysis?.docs_json?.key_concepts && ws.analysis.docs_json.key_concepts.length > 0 && (
                            <div className="rounded-lg p-6" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
                              <p className="text-sm font-medium mb-2" style={{ color: "var(--muted-foreground)" }}>Key Concepts</p>
                              <ul className="list-disc list-inside space-y-1">
                                {ws.analysis.docs_json.key_concepts.map((c: string, i: number) => (
                                  <li key={i} className="text-sm" style={{ color: "var(--muted-foreground)" }}>{c}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </>
                      ) : (
                        <>
                          {ws?.analysis?.docs_json?.professional_summary && (
                            <div className="rounded-lg p-6" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
                              <h3 className="font-semibold mb-3" style={{ color: "var(--foreground)" }}>Technical Summary</h3>
                              <p style={{ color: "var(--muted-foreground)" }}>
                                {ws.analysis.docs_json.professional_summary}
                              </p>
                            </div>
                          )}
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
                          {["api_architecture", "database_architecture", "deployment"].map((key) => {
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
                        </>
                      )}
                    </TabsContent>
                    <TabsContent value="architecture" className="mt-6">
                      <ArchitectureDiagram
                        graph={ws?.analysis?.graph_json}
                        docs={ws?.analysis?.docs_json}
                        onFileSelect={handleFileSelect}
                      />
                      {ws?.analysis?.docs_json?.auth_flow && (
                        <div className="mt-4 rounded-lg p-4" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
                          <h3 className="font-semibold mb-2" style={{ color: "var(--foreground)" }}>Auth Flow</h3>
                          <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>{ws.analysis.docs_json.auth_flow}</p>
                        </div>
                      )}
                    </TabsContent>
                    <TabsContent value="docs" className="mt-6 space-y-4">
                      {["api_architecture", "database_architecture", "deployment"].map((key) => {
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
              <IDELayout
                workspaceId={workspaceId}
                activeFile={activeFile}
                fileContent={fileContent}
                editedContent={editedContent}
                loadingFile={loadingFile}
                onEditorChange={handleEditorChange}
              />
            </TabsContent>

            <TabsContent value="terminal" className="flex-1 min-h-0 p-0 m-0 data-[state=active]:flex">
              {isReady ? (
                <TerminalPanel workspaceId={workspaceId} />
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <p style={{ color: "var(--muted-foreground)" }}>Analysis not ready yet</p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </ResizablePanel>

        <ResizableHandle style={{ background: "var(--border)" }} />

        <ResizablePanel defaultSize={25}>
          <div className="h-full flex flex-col">
            <div className="flex border-b" style={{ borderColor: "var(--border)", background: "var(--sidebar)" }}>
              <button
                onClick={() => setRightPanel("ai")}
                className="flex-1 px-3 py-2 text-sm font-medium transition-colors"
                style={{
                  background: rightPanel === "ai" ? "var(--background)" : "transparent",
                  color: rightPanel === "ai" ? "var(--accent)" : "var(--muted-foreground)",
                  borderBottom: rightPanel === "ai" ? "2px solid var(--accent)" : "2px solid transparent",
                }}
              >
                <Bot className="w-4 h-4 inline mr-1" /> AI Chat
              </button>
              <button
                onClick={() => setRightPanel("git")}
                className="flex-1 px-3 py-2 text-sm font-medium transition-colors"
                style={{
                  background: rightPanel === "git" ? "var(--background)" : "transparent",
                  color: rightPanel === "git" ? "var(--accent)" : "var(--muted-foreground)",
                  borderBottom: rightPanel === "git" ? "2px solid var(--accent)" : "2px solid transparent",
                }}
              >
                <GitBranch className="w-4 h-4 inline mr-1" /> Git
              </button>
            </div>
            {rightPanel === "ai" ? (
              <AIAssistantPanel workspaceId={workspaceId} />
            ) : (
              <GitPanel workspaceId={workspaceId} activeIssueNumber={ws?.active_issue_number ?? undefined}
                onSaveFile={handleSaveCurrentFile} currentBranch={ws?.branch ?? null} />
            )}
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
    </ErrorBoundary>
  );
}
