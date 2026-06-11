"use client";
import { useCallback, useEffect } from "react";
import dynamic from "next/dynamic";
import { PanelRightClose, Loader2 } from "lucide-react";
import { api } from "@/lib/api";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

interface IDELayoutProps {
  workspaceId: number;
  activeFile: string | null;
  fileContent: string;
  editedContent: string;
  loadingFile: boolean;
  onEditorChange: (value: string | undefined) => void;
}

export function IDELayout({ workspaceId, activeFile, fileContent, editedContent, loadingFile, onEditorChange }: IDELayoutProps) {
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

  const getLanguage = (path: string) => {
    const ext = path.split(".").pop()?.toLowerCase();
    const map: Record<string, string> = {
      ts: "typescript", tsx: "typescript", js: "javascript", jsx: "javascript",
      py: "python", rs: "rust", go: "go", rb: "ruby", java: "java",
      json: "json", yaml: "yaml", yml: "yaml", md: "markdown",
      css: "css", html: "html",
      ex: "elixir", exs: "elixir", sh: "shell", sql: "sql",
      dockerfile: "dockerfile", c: "c", cpp: "cpp", h: "cpp",
      cs: "csharp", toml: "toml", xml: "xml",
    };
    return map[ext || ""] || "plaintext";
  };

  return (
    <div className="h-full flex flex-col" style={{ background: "var(--background)" }}>
      {activeFile ? (
        <>
          <div className="flex items-center px-4 py-2 border-b text-sm gap-2 shrink-0"
               style={{ borderColor: "var(--border)", background: "var(--sidebar)" }}>
            <span style={{ color: "var(--accent)" }}>{activeFile}</span>
            <span className="ml-auto text-xs" style={{ color: "var(--muted-foreground)" }}>
              {getLanguage(activeFile)}
            </span>
          </div>
          <div className="flex-1 min-h-0 relative">
            {loadingFile ? (
              <div className="absolute inset-0 flex items-center justify-center bg-background/50">
                <Loader2 className="w-8 h-8 animate-spin" style={{color: "var(--accent)"}} />
              </div>
            ) : (
              <MonacoEditor
                height="100%"
                language={getLanguage(activeFile)}
                value={fileContent}
                onChange={onEditorChange}
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
            <p style={{ color: "var(--muted-foreground)" }}>Select a file from the explorer</p>
          </div>
        </div>
      )}
    </div>
  );
}
