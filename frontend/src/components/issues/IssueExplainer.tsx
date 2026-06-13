"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, FileCode, BookOpen, Lightbulb, Wand2, Loader2, Pencil, Download, CheckCircle, ExternalLink, GitBranch } from "lucide-react";

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
  const [solvingStep, setSolvingStep] = useState("");
  const [solvedResult, setSolvedResult] = useState<any>(null);
  const [solvedOpen, setSolvedOpen] = useState(false);
  const [manualBranch, setManualBranch] = useState("");
  const [manualCreating, setManualCreating] = useState(false);
  const [manualDialog, setManualDialog] = useState(false);
  const [updatingPR, setUpdatingPR] = useState(false);
  const [updatingPRStep, setUpdatingPRStep] = useState("");
  const [updateResult, setUpdateResult] = useState<any>(null);
  const [updatePRInput, setUpdatePRInput] = useState("");

  useEffect(() => {
    setLoading(true);
    api.issues.explain(workspaceId, issue.number)
      .then((res) => setData(res))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [workspaceId, issue.number]);

  const handleSolveAI = async () => {
    setSolving(true);
    setSolvingStep("Creating branch...");
    try {
      setSolvingStep("Generating solution...");
      const result = await api.ai.solveAndPR(workspaceId, issue.number);
      if (result.error) {
        setSolvedResult({ error: result.error });
        setSolvedOpen(true);
      } else {
        setSolvedResult(result);
        setSolvedOpen(true);
      }
    } catch (e: any) {
      setSolvedResult({ error: e.message });
      setSolvedOpen(true);
    } finally {
      setSolving(false);
    }
  };

  const handleUpdatePR = async () => {
    const prNum = solvedResult?.pr_number;
    if (!prNum) return;
    setUpdatingPR(true);
    setUpdatingPRStep("Fetching review comments...");
    try {
      setUpdatingPRStep("Generating updated solution...");
      const result = await api.ai.updatePR(workspaceId, prNum);
      setUpdateResult(result);
      setUpdatingPRStep("Done");
    } catch (e: any) {
      setUpdateResult({ error: e.message });
    } finally {
      setUpdatingPR(false);
    }
  };

  const handleUpdatePRFromInput = async () => {
    const prNum = parseInt(updatePRInput, 10);
    if (!prNum) return;
    setUpdatingPR(true);
    setUpdatingPRStep("Fetching review comments...");
    try {
      setUpdatingPRStep("Generating updated solution...");
      const result = await api.ai.updatePR(workspaceId, prNum);
      setUpdateResult(result);
      setUpdatePRInput("");
      setUpdatingPRStep("Done");
    } catch (e: any) {
      setUpdateResult({ error: e.message });
    } finally {
      setUpdatingPR(false);
    }
  };

  const handleSolveManual = async () => {
    setManualCreating(true);
    try {
      const res = await api.git.manualBranch(workspaceId, issue.number);
      setManualBranch(res.branch);
      setManualDialog(true);
    } catch (e: any) {
      setSolvedResult({ error: e.message });
      setSolvedOpen(true);
    } finally {
      setManualCreating(false);
    }
  };

  const handleDownloadZip = async () => {
    try {
      const res = await api.git.downloadZip(workspaceId);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `repo-${manualBranch}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setSolvedResult({ error: "Failed to download zip" });
      setSolvedOpen(true);
    }
  };

  const handleEditInBrowser = () => {
    setManualDialog(false);
    onClose();
    router.push(`/workspace/${workspaceId}?tab=code`);
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

              {/* Buttons */}
              <div className="flex flex-col gap-2 pt-4">
                <div className="flex gap-2">
                  <Button
                    onClick={handleSolveAI}
                    disabled={solving}
                    className="flex-1"
                    style={{ background: "var(--accent)" }}
                  >
                    {solving ? (
                      <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> {solvingStep}</>
                    ) : (
                      <><Wand2 className="w-4 h-4 mr-1" /> Solve with AI</>
                    )}
                  </Button>
                  <Button
                    onClick={handleSolveManual}
                    disabled={manualCreating}
                    variant="outline"
                    className="flex-1"
                    style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
                  >
                    {manualCreating ? (
                      <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Creating branch...</>
                    ) : (
                      <><Pencil className="w-4 h-4 mr-1" /> Solve Manually</>
                    )}
                  </Button>
                </div>
                <Button
                  onClick={() => {
                    onClose();
                    router.push(`/workspace/${workspaceId}?tab=code`);
                  }}
                  variant="outline"
                  className="w-full"
                  style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}
                >
                  <FileCode className="w-4 h-4 mr-1" /> Open in IDE
                </Button>
                <div className="border-t pt-4" style={{ borderColor: "var(--border)" }}>
                  <p className="text-xs font-medium mb-2" style={{ color: "var(--muted-foreground)" }}>
                    Update Existing PR with Review Feedback
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      placeholder="PR #"
                      value={updatePRInput}
                      onChange={(e) => setUpdatePRInput(e.target.value)}
                      className="flex-1 px-3 py-2 rounded-lg text-sm"
                      style={{ background: "var(--background)", border: "1px solid var(--border)", color: "var(--foreground)" }}
                    />
                    <Button
                      onClick={handleUpdatePRFromInput}
                      disabled={updatingPR || !updatePRInput}
                      variant="outline"
                      size="sm"
                      style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
                    >
                      {updatingPR ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        "Update"
                      )}
                    </Button>
                  </div>
                  {updateResult && (
                    <p className="text-xs mt-2" style={{ color: updateResult.error ? "rgb(239, 68, 68)" : "rgb(34, 197, 94)" }}>
                      {updateResult.error || updateResult.message}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <p className="mt-6 text-sm" style={{ color: "var(--muted-foreground)" }}>
              Could not load explanation.
            </p>
          )}
        </SheetContent>
      </Sheet>

      {/* Solve with AI - Result Dialog */}
      <Dialog open={solvedOpen} onOpenChange={setSolvedOpen}>
        <DialogContent
          className="w-full max-w-lg"
          style={{ background: "var(--card)", borderColor: "var(--border)" }}
        >
          <DialogHeader>
            <DialogTitle style={{ color: "var(--foreground)" }}>
              {solvedResult?.error ? "Solution Failed" : "Solution Complete"}
            </DialogTitle>
            <DialogDescription style={{ color: "var(--muted-foreground)" }}>
              {solvedResult?.error
                ? solvedResult.error
                : `Issue #${issue.number} — ${issue.title.slice(0, 60)}`}
            </DialogDescription>
          </DialogHeader>

          {solvedResult?.error ? (
            <div className="p-4 rounded-lg text-sm" style={{ background: "rgba(239, 68, 68, 0.1)", color: "rgb(239, 68, 68)" }}>
              {solvedResult.error}
            </div>
          ) : solvedResult ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm" style={{ color: "var(--foreground)" }}>
                <CheckCircle className="w-5 h-5" style={{ color: "#22c55e" }} />
                <span>Branch: <span className="font-mono" style={{ color: "var(--accent)" }}>{solvedResult.branch}</span></span>
              </div>
              {solvedResult.files_changed && solvedResult.files_changed.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-1" style={{ color: "var(--foreground)" }}>Files changed:</p>
                  <ul className="space-y-1">
                    {solvedResult.files_changed.map((f: string) => (
                      <li key={f} className="text-xs font-mono px-2 py-1 rounded" style={{ background: "var(--sidebar)", color: "var(--accent)" }}>{f}</li>
                    ))}
                  </ul>
                </div>
              )}
              {solvedResult.pr_url && (
                <a
                  href={solvedResult.pr_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  style={{ background: "var(--accent)", color: "white" }}
                >
                  <ExternalLink className="w-4 h-4" /> View Pull Request
                </a>
              )}
              {solvedResult.pr_number && !updateResult && (
                <Button
                  onClick={handleUpdatePR}
                  disabled={updatingPR}
                  variant="outline"
                  className="w-full"
                  style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
                >
                  {updatingPR ? (
                    <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> {updatingPRStep}</>
                  ) : (
                    <><GitBranch className="w-4 h-4 mr-1" /> Update PR #{solvedResult.pr_number} with Feedback</>
                  )}
                </Button>
              )}
              {updateResult && (
                <div className="p-3 rounded-lg text-sm" style={{ background: updateResult.error ? "rgba(239, 68, 68, 0.1)" : "rgba(34, 197, 94, 0.1)", color: updateResult.error ? "rgb(239, 68, 68)" : "rgb(34, 197, 94)" }}>
                  {updateResult.error || updateResult.message}
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin" style={{ color: "var(--accent)" }} />
            </div>
          )}
          <div className="flex justify-end">
            <Button
              onClick={() => setSolvedOpen(false)}
              variant="outline"
              style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Solve Manually - Choice Dialog */}
      <Dialog open={manualDialog} onOpenChange={setManualDialog}>
        <DialogContent
          className="w-full max-w-md"
          style={{ background: "var(--card)", borderColor: "var(--border)" }}
        >
          <DialogHeader>
            <DialogTitle style={{ color: "var(--foreground)" }}>
              Branch Created
            </DialogTitle>
            <DialogDescription style={{ color: "var(--muted-foreground)" }}>
              Branch <span className="font-mono" style={{ color: "var(--accent)" }}>{manualBranch}</span> is ready. Choose how to proceed.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3 py-4">
            <button
              onClick={handleEditInBrowser}
              className="flex items-center gap-4 p-4 rounded-lg text-left transition-colors hover:opacity-80"
              style={{ background: "var(--sidebar)", border: "1px solid var(--border)" }}
            >
              <div className="rounded-lg p-2" style={{ background: "var(--accent)20" }}>
                <Pencil className="w-5 h-5" style={{ color: "var(--accent)" }} />
              </div>
              <div>
                <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>Edit in Browser</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
                  Use the built-in editor and Git panel to make changes and push directly
                </p>
              </div>
            </button>
            <button
              onClick={handleDownloadZip}
              className="flex items-center gap-4 p-4 rounded-lg text-left transition-colors hover:opacity-80"
              style={{ background: "var(--sidebar)", border: "1px solid var(--border)" }}
            >
              <div className="rounded-lg p-2" style={{ background: "rgba(34, 197, 94, 0.2)" }}>
                <Download className="w-5 h-5" style={{ color: "#22c55e" }} />
              </div>
              <div>
                <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>Download Zip</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
                  Open in VS Code or your local IDE with the branch already set up
                </p>
              </div>
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
