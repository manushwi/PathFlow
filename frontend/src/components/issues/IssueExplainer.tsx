"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ErrorBoundary } from "@/components/layout/ErrorBoundary";
import { DiffViewer } from "@/components/diff/DiffViewer";
import { AlertTriangle, FileCode, BookOpen, Lightbulb, Wand2, Loader2 } from "lucide-react";

const riskColors: Record<string, string> = {
  low: "bg-green-500/20 text-green-400",
  medium: "bg-yellow-500/20 text-yellow-400",
  high: "bg-red-500/20 text-red-400",
};

interface IssueExplainerProps {
  workspaceId: number;
  issue: any;
  onClose: () => void;
}

export function IssueExplainer({ workspaceId, issue, onClose }: IssueExplainerProps) {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [solving, setSolving] = useState(false);
  const [solution, setSolution] = useState<any>(null);
  const [solutionOpen, setSolutionOpen] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.issues.explain(workspaceId, issue.number)
      .then((res) => setData(res))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [workspaceId, issue.number]);

  const handleSolve = async () => {
    setSolving(true);
    try {
      const result = await api.ai.solveIssue(workspaceId, issue.number);
      setSolution(result);
      setSolutionOpen(true);
    } catch (e: any) {
      setSolution({ error: e.message });
      setSolutionOpen(true);
    } finally {
      setSolving(false);
    }
  };

  return (
    <>
      <Sheet open onOpenChange={onClose}>
        <SheetContent className="w-[500px] overflow-y-auto" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
          <SheetHeader>
            <SheetTitle style={{ color: "var(--foreground)" }}>
              #{issue.number} {issue.title}
            </SheetTitle>
          </SheetHeader>

          {loading ? (
            <div className="space-y-4 mt-6">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : data?.explanation ? (
            <div className="mt-6 space-y-6">
              <div className="flex items-center gap-2">
                <Lightbulb className="w-4 h-4" style={{ color: "var(--accent)" }} />
                <span className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>Summary</span>
              </div>
              <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
                {data.explanation.summary}
              </p>

              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" style={{ color: "var(--warning)" }} />
                <span className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>Why It Happens</span>
              </div>
              <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
                {data.explanation.why_it_happens}
              </p>

              <div className="flex items-center gap-2">
                <FileCode className="w-4 h-4" style={{ color: "var(--info)" }} />
                <span className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>Files Involved</span>
              </div>
              <div className="space-y-1">
                {(data.explanation.files_likely_involved || []).map((f: string) => (
                  <div key={f} className="text-sm px-3 py-1.5 rounded" style={{ background: "var(--sidebar)", color: "var(--accent)", fontFamily: "monospace" }}>
                    {f}
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <Lightbulb className="w-4 h-4" style={{ color: "var(--success)" }} />
                <span className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>Suggested Fix</span>
              </div>
              <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
                {data.explanation.suggested_fix}
              </p>

              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4" style={{ color: "var(--accent)" }} />
                <span className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>Learning Resources</span>
              </div>
              <ul className="space-y-1">
                {(data.explanation.learning_resources || []).map((r: string, i: number) => (
                  <li key={i} className="text-sm" style={{ color: "var(--accent)" }}>{r}</li>
                ))}
              </ul>

              <div className="flex items-center gap-2">
                <Badge variant="outline" className={riskColors[data.explanation.risk_level] || ""}>
                  {data.explanation.risk_level} risk
                </Badge>
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  onClick={() => router.push(`/workspace/${workspaceId}?tab=code&issue=${issue.number}`)}
                  style={{ background: "var(--accent)" }}>
                  Open in IDE
                </Button>
                <Button
                  onClick={handleSolve}
                  disabled={solving}
                  variant="outline"
                  style={{ borderColor: "var(--border)", color: "var(--foreground)" }}>
                  {solving ? (
                    <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Solving...</>
                  ) : (
                    <><Wand2 className="w-4 h-4 mr-1" /> Solve with AI</>
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <p className="mt-6 text-sm" style={{ color: "var(--muted-foreground)" }}>
              Could not load explanation.
            </p>
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={solutionOpen} onOpenChange={setSolutionOpen}>
        <DialogContent
          className="w-full max-w-3xl max-h-[85vh]"
          style={{ background: "var(--card)", borderColor: "var(--border)" }}
        >
          <DialogHeader>
            <DialogTitle style={{ color: "var(--foreground)" }}>
              AI Solution — #{issue.number} {issue.title}
            </DialogTitle>
            <DialogDescription style={{ color: "var(--muted-foreground)" }}>
              Generated solution with file changes
            </DialogDescription>
          </DialogHeader>

          {solution?.error ? (
            <div className="p-4 rounded-lg text-sm" style={{ background: "rgba(239, 68, 68, 0.1)", color: "rgb(239, 68, 68)" }}>
              Failed to generate solution: {solution.error}
            </div>
          ) : solution ? (
            <ScrollArea className="flex-1 max-h-[65vh] pr-4">
              <div className="space-y-6">
                {solution.explanation && (
                  <div>
                    <h4 className="text-sm font-semibold mb-2" style={{ color: "var(--foreground)" }}>Explanation</h4>
                    <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>{solution.explanation}</p>
                  </div>
                )}

                {solution.plan && solution.plan.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold mb-2" style={{ color: "var(--foreground)" }}>Plan</h4>
                    <ol className="space-y-1">
                      {solution.plan.map((step: string, i: number) => (
                        <li key={i} className="text-sm flex gap-2" style={{ color: "var(--muted-foreground)" }}>
                          <span style={{ color: "var(--accent)" }}>{i + 1}.</span>
                          <span>{step}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}

                {solution.files_to_change && solution.files_to_change.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold mb-3" style={{ color: "var(--foreground)" }}>File Changes</h4>
                    <DiffViewer files={solution.files_to_change} />
                  </div>
                )}
              </div>
            </ScrollArea>
          ) : (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin" style={{ color: "var(--accent)" }} />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
