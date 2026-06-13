"use client";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { FileCode, FolderTree } from "lucide-react";

interface KeyFile {
  path: string;
  role: string;
}

interface ModuleData {
  label: string;
  path: string;
  purpose: string;
  key_files: KeyFile[];
  files: number;
}

interface WorkflowStep {
  step: string;
  file: string;
}

interface Workflow {
  name: string;
  description: string;
  steps: WorkflowStep[];
}

interface ModuleDetailPanelProps {
  module: ModuleData | null;
  workflows: Workflow[];
  onClose: () => void;
  onFileSelect?: (path: string) => void;
}

export function ModuleDetailPanel({ module, workflows, onClose, onFileSelect }: ModuleDetailPanelProps) {
  if (!module) return null;

  const touchingWorkflows = workflows.filter((w) =>
    w.steps?.some((s) => s.file?.startsWith(module.path) || module.key_files?.some((kf) => s.file === kf.path))
  );

  return (
    <Sheet open={!!module} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <div className="flex items-center gap-2">
            <FolderTree className="w-5 h-5 text-[#6366f1]" />
            <SheetTitle>{module.label}</SheetTitle>
          </div>
          {module.path && (
            <SheetDescription className="font-mono text-xs">{module.path}</SheetDescription>
          )}
        </SheetHeader>

        <div className="px-4 py-4 space-y-6">
          {module.purpose && (
            <div>
              <h4 className="text-sm font-medium mb-1" style={{ color: "var(--foreground)" }}>Purpose</h4>
              <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>{module.purpose}</p>
            </div>
          )}

          {module.key_files && module.key_files.length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-2" style={{ color: "var(--foreground)" }}>
                Key Files ({module.key_files.length})
              </h4>
              <div className="space-y-2">
                {module.key_files.map((kf) => (
                  <button
                    key={kf.path}
                    onClick={() => onFileSelect?.(kf.path)}
                    className="w-full text-left rounded-lg p-3 transition-colors hover:bg-[#1e1e2e]"
                    style={{ border: "1px solid var(--border)" }}
                  >
                    <div className="flex items-center gap-2">
                      <FileCode className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--accent)" }} />
                      <span className="text-xs font-mono" style={{ color: "var(--foreground)" }}>
                        {kf.path}
                      </span>
                    </div>
                    <p className="text-xs mt-1" style={{ color: "var(--muted-foreground)" }}>{kf.role}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {touchingWorkflows.length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-2" style={{ color: "var(--foreground)" }}>
                Related Workflows ({touchingWorkflows.length})
              </h4>
              <div className="space-y-2">
                {touchingWorkflows.map((wf) => (
                  <div
                    key={wf.name}
                    className="rounded-lg p-3"
                    style={{ border: "1px solid var(--border)" }}
                  >
                    <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>{wf.name}</p>
                    <p className="text-xs mt-1" style={{ color: "var(--muted-foreground)" }}>{wf.description}</p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {wf.steps?.filter((s) => s.file).map((s) => (
                        <Badge key={s.step} variant="outline" className="text-[10px]">
                          {s.file.split("/").pop()}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
