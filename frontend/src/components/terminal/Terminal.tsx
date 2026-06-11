"use client";
import { useState, useRef, useEffect } from "react";
import { api } from "@/lib/api";
import { Terminal as TerminalIcon, Trash2, Loader2 } from "lucide-react";

interface TerminalLine {
  type: "stdout" | "stderr" | "input" | "system";
  text: string;
}

interface TerminalPanelProps {
  workspaceId: number;
}

export function TerminalPanel({ workspaceId }: TerminalPanelProps) {
  const [lines, setLines] = useState<TerminalLine[]>([
    { type: "system", text: "PatchFlow Terminal — cwd: workspace root" },
    { type: "system", text: "" },
  ]);
  const [input, setInput] = useState("");
  const [running, setRunning] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [lines]);

  const handleCommand = async () => {
    const cmd = input.trim();
    if (!cmd || running) return;
    setLines((prev) => [...prev, { type: "input", text: `$ ${cmd}` }]);
    setInput("");
    setRunning(true);
    try {
      const res = await api.terminal.exec(workspaceId, cmd);
      if (res.stdout) {
        setLines((prev) => [...prev, ...res.stdout.split("\n").map((l: string) => ({ type: "stdout" as const, text: l }))]);
      }
      if (res.stderr) {
        setLines((prev) => [...prev, ...res.stderr.split("\n").map((l: string) => ({ type: "stderr" as const, text: l }))]);
      }
      if (res.exit_code !== 0 && !res.stderr) {
        setLines((prev) => [...prev, { type: "stderr", text: `exit code: ${res.exit_code}` }]);
      }
    } catch (e: any) {
      setLines((prev) => [...prev, { type: "stderr", text: `Error: ${e.message}` }]);
    } finally {
      setRunning(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleCommand();
    }
  };

  const clearTerminal = () => {
    setLines([]);
  };

  return (
    <div className="flex flex-col h-full" style={{ background: "#0d0d14" }}>
      <div
        className="flex items-center justify-between px-4 py-2 border-b shrink-0"
        style={{ borderColor: "var(--border)", background: "var(--sidebar)" }}
      >
        <div className="flex items-center gap-2 text-sm font-medium" style={{ color: "var(--muted-foreground)" }}>
          <TerminalIcon className="w-4 h-4" style={{ color: "var(--accent)" }} />
          Terminal
        </div>
        <button
          onClick={clearTerminal}
          className="p-1 rounded transition-colors hover:bg-white/10"
          style={{ color: "var(--muted-foreground)" }}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-auto p-3 font-mono text-sm leading-relaxed"
        style={{ background: "#0d0d14" }}
        onClick={() => inputRef.current?.focus()}
      >
        {lines.map((line, i) => (
          <div
            key={i}
            className="whitespace-pre-wrap break-all"
            style={{
              color:
                line.type === "stderr"
                  ? "rgb(239, 68, 68)"
                  : line.type === "input"
                    ? "rgb(99, 102, 241)"
                    : line.type === "system"
                      ? "rgb(148, 163, 184)"
                      : "rgb(226, 232, 240)",
              minHeight: "1.25em",
            }}
          >
            {line.text || "\u00A0"}
          </div>
        ))}
        {running && (
          <div className="flex items-center gap-2 mt-1" style={{ color: "var(--accent)" }}>
            <Loader2 className="w-3 h-3 animate-spin" />
            <span className="text-xs">Running...</span>
          </div>
        )}
      </div>

      <div className="p-2 border-t shrink-0" style={{ borderColor: "var(--border)", background: "#0d0d14" }}>
        <div className="flex items-center gap-2 px-2 py-1 rounded" style={{ background: "var(--sidebar)" }}>
          <span className="text-xs font-mono shrink-0" style={{ color: "var(--accent)" }}>$</span>
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={running}
            placeholder="Type a command..."
            className="flex-1 bg-transparent outline-none text-sm font-mono"
            style={{ color: "var(--foreground)" }}
            autoFocus
          />
        </div>
      </div>
    </div>
  );
}
