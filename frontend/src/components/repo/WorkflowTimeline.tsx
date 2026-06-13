"use client";
import { FileCode, ArrowDown } from "lucide-react";

interface WorkflowStep {
  step: string;
  file: string;
}

interface Workflow {
  name: string;
  description: string;
  steps: WorkflowStep[];
}

interface WorkflowTimelineProps {
  workflows: Workflow[];
  onFileSelect?: (path: string) => void;
}

export function WorkflowTimeline({ workflows, onFileSelect }: WorkflowTimelineProps) {
  if (!workflows || workflows.length === 0) return null;

  return (
    <div className="space-y-6">
      <h3 className="font-semibold text-sm" style={{ color: "var(--foreground)" }}>Workflows</h3>
      {workflows.map((wf) => (
        <div
          key={wf.name}
          className="rounded-lg p-4"
          style={{ background: "var(--card)", border: "1px solid var(--border)" }}
        >
          <h4 className="font-medium text-sm mb-1" style={{ color: "var(--foreground)" }}>
            {wf.name}
          </h4>
          {wf.description && (
            <p className="text-xs mb-3" style={{ color: "var(--muted-foreground)" }}>
              {wf.description}
            </p>
          )}
          {wf.steps && wf.steps.length > 0 && (
            <div className="relative">
              {wf.steps.map((s, i) => (
                <div key={i} className="flex gap-3 pb-3 last:pb-0">
                  <div className="flex flex-col items-center">
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                      style={{ background: "var(--accent)", color: "white" }}
                    >
                      {i + 1}
                    </div>
                    {i < wf.steps.length - 1 && (
                      <div className="w-px flex-1 mt-1" style={{ background: "var(--border)" }} />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm" style={{ color: "var(--foreground)" }}>{s.step}</p>
                    {s.file && (
                      <button
                        onClick={() => onFileSelect?.(s.file)}
                        className="flex items-center gap-1 mt-0.5 text-xs hover:underline"
                        style={{ color: "var(--accent)" }}
                      >
                        <FileCode className="w-3 h-3" />
                        {s.file}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
