"use client";
import { useState, useCallback, useEffect } from "react";
import dynamic from "next/dynamic";
import { FileTree } from "@/components/repo/FileTree";
import { AIAssistantPanel } from "@/components/ide/AIAssistantPanel";
import { GitPanel } from "@/components/ide/GitPanel";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import useSWR from "swr";
import { api } from "@/lib/api";
import { Bot, GitBranch, PanelRightClose, Loader2 } from "lucide-react";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

interface IDELayoutProps {
  workspaceId: number;
  activeIssueNumber?: number;
}

export function IDELayout({ workspaceId, activeIssueNumber }: IDELayoutProps) {
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState("");
  const [editedContent, setEditedContent] = useState("");
  const [loadingFile, setLoadingFile] = useState(false);
  const [rightPanel, setRightPanel] = useState<"ai" | "git">("ai");
  const { data: files } = useSWR(`/files/${workspaceId}`, () => api.files.tree(workspaceId));
  const { data: ws } = useSWR(`/workspace/${workspaceId}`, () => api.workspace.get(workspaceId));

  const handleEditorChange = useCallback((value: string | undefined) => {
    if (value !== undefined) setEditedContent(value);
  }, []);

  const handleFileSelect = async (path: string) => {
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
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (activeFile && editedContent) {
          api.files.save(workspaceId, activeFile, editedContent)
            .then(() => {})
            .catch(() => {});
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

  const getLanguage = (path: string) => {
    const ext = path.split(".").pop()?.toLowerCase();
    const map: Record<string, string> = {
      ts: "typescript", tsx: "typescript", js: "javascript", jsx: "javascript",
      py: "python", rs: "rust", go: "go", rb: "ruby", java: "java",
      json: "json", yaml: "yaml", yml: "yaml", md: "markdown",
      css: "css", html: "html",
    };
    return map[ext || ""] || "plaintext";
  };

  return (
    <div className="flex flex-col h-full">
      <ResizablePanelGroup className="flex-1" orientation="horizontal">
        <ResizablePanel defaultSize={22} minSize={15} maxSize={35}>
          <div className="h-full flex flex-col" style={{ background: "var(--sidebar)" }}>
            <div className="p-3 border-b text-sm font-medium flex items-center gap-2"
                 style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}>
              <GitBranch className="w-4 h-4" style={{ color: "var(--accent)" }} />
              {ws?.repo_name || "Explorer"}
            </div>
            <div className="flex-1 overflow-auto">
              <FileTree
                tree={files?.tree || {}}
                onFileSelect={handleFileSelect}
                activeFile={activeFile || undefined}
              />
            </div>
          </div>
        </ResizablePanel>

        <ResizableHandle style={{ background: "var(--border)" }} />

        <ResizablePanel defaultSize={48} minSize={30}>
          <div className="h-full flex flex-col" style={{ background: "var(--background)" }}>
            {activeFile ? (
              <>
                <div className="flex items-center px-4 py-2 border-b text-sm gap-2"
                     style={{ borderColor: "var(--border)", background: "var(--sidebar)" }}>
                  <span style={{ color: "var(--accent)" }}>{activeFile}</span>
                  <span className="ml-auto text-xs" style={{ color: "var(--muted-foreground)" }}>
                    {getLanguage(activeFile)}
                  </span>
                </div>
                <div className="flex-1">
                  {loadingFile ? (
                    <div className="flex-1 flex items-center justify-center h-full">
                      <Loader2 className="w-8 h-8 animate-spin" style={{color: "var(--accent)"}} />
                    </div>
                  ) : (
                    <MonacoEditor
                      language={getLanguage(activeFile)}
                      value={fileContent}
                      onChange={handleEditorChange}
                      theme="vs-dark"
                      options={{
                        fontSize: 13,
                        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                        minimap: { enabled: true },
                        scrollBeyondLastLine: false,
                        tabSize: 2,
                        automaticLayout: true,
                      }}
                    />
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <PanelRightClose className="w-12 h-12 mx-auto mb-4" style={{ color: "var(--muted-foreground)" }} />
                  <p style={{ color: "var(--muted-foreground)" }}>Select a file to view</p>
                </div>
              </div>
            )}
          </div>
        </ResizablePanel>

        <ResizableHandle style={{ background: "var(--border)" }} />

        <ResizablePanel defaultSize={30} minSize={20} maxSize={45}>
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
              <GitPanel workspaceId={workspaceId} activeIssueNumber={activeIssueNumber} />
            )}
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
