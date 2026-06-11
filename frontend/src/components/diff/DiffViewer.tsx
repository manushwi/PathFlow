"use client";
import { useMemo } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface DiffFile {
  path: string;
  description?: string;
  diff: string;
}

interface DiffViewerProps {
  files: DiffFile[];
}

interface ParsedLine {
  type: "add" | "del" | "header" | "hunk" | "context";
  content: string;
  oldLine?: number;
  newLine?: number;
}

function parseDiff(diff: string, filePath: string): { lines: ParsedLine[] } {
  const lines: ParsedLine[] = [];
  const textLines = diff.split("\n");

  for (const line of textLines) {
    if (line.startsWith("+++ ") || line.startsWith("--- ")) {
      continue;
    }
    if (line.startsWith("@@")) {
      const match = line.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      lines.push({
        type: "hunk",
        content: line,
        oldLine: match ? Number(match[1]) : undefined,
        newLine: match ? Number(match[2]) : undefined,
      });
    } else if (line.startsWith("+")) {
      lines.push({ type: "add", content: line });
    } else if (line.startsWith("-")) {
      lines.push({ type: "del", content: line });
    } else {
      lines.push({ type: "context", content: line });
    }
  }

  return { lines };
}

export function DiffViewer({ files }: DiffViewerProps) {
  if (!files || files.length === 0) {
    return (
      <div className="text-sm text-center py-8" style={{ color: "var(--muted-foreground)" }}>
        No changes to display
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {files.map((file, idx) => (
        <DiffFileBlock key={idx} file={file} />
      ))}
    </div>
  );
}

function DiffFileBlock({ file }: { file: DiffFile }) {
  const { lines } = useMemo(() => parseDiff(file.diff, file.path), [file.diff, file.path]);

  return (
    <div
      className="rounded-lg overflow-hidden border"
      style={{ borderColor: "var(--border)", background: "var(--card)" }}
    >
      <div
        className="flex items-center gap-2 px-4 py-2 border-b text-sm font-mono"
        style={{ borderColor: "var(--border)", background: "var(--sidebar)" }}
      >
        <span style={{ color: "var(--accent)" }}>{file.path}</span>
        {file.description && (
          <span className="text-xs ml-2" style={{ color: "var(--muted-foreground)" }}>
            — {file.description}
          </span>
        )}
      </div>
      <ScrollArea className="max-h-80">
        <div className="text-xs font-mono leading-relaxed">
          {lines.map((line, i) => (
            <div
              key={i}
              className="flex px-4 py-px"
              style={{
                background:
                  line.type === "add"
                    ? "rgba(34, 197, 94, 0.1)"
                    : line.type === "del"
                      ? "rgba(239, 68, 68, 0.1)"
                      : line.type === "hunk"
                        ? "var(--sidebar)"
                        : "transparent",
                color:
                  line.type === "add"
                    ? "rgb(34, 197, 94)"
                    : line.type === "del"
                      ? "rgb(239, 68, 68)"
                      : line.type === "hunk"
                        ? "var(--accent)"
                        : "var(--foreground)",
              }}
            >
              <span className="w-8 shrink-0 text-right mr-4" style={{ color: "var(--muted-foreground)" }}>
                {line.type === "add" ? "+" : line.type === "del" ? "-" : " "}
              </span>
              <span className="flex-1 whitespace-pre-wrap break-all">
                {line.content === "" ? " " : line.content}
              </span>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
