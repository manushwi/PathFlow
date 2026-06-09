"use client";
import { useState } from "react";
import useSWR from "swr";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { GitBranch, MessageSquare, GitPullRequest } from "lucide-react";

interface GitPanelProps {
  workspaceId: number;
}

export function GitPanel({ workspaceId }: GitPanelProps) {
  const { data, mutate } = useSWR(`/diff/${workspaceId}`, () => api.git.diff(workspaceId));
  const [commitMsg, setCommitMsg] = useState("");
  const [committing, setCommitting] = useState(false);
  const [prDialog, setPrDialog] = useState(false);
  const [prData, setPrData] = useState<any>(null);

  const handleCommit = async () => {
    if (!commitMsg.trim()) return;
    setCommitting(true);
    try {
      await api.git.commit(workspaceId, commitMsg);
      setCommitMsg("");
      mutate();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setCommitting(false);
    }
  };

  const handleGeneratePR = async () => {
    try {
      const result = await api.git.generatePR(workspaceId, 0, data?.diff || "");
      setPrData(result);
      setPrDialog(true);
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleSubmitPR = async () => {
    try {
      const result = await api.git.createPR(workspaceId, prData.title, prData.body);
      alert(`PR created: ${result.pr_url}`);
      setPrDialog(false);
    } catch (e: any) {
      alert(e.message);
    }
  };

  return (
    <div className="flex flex-col h-full" style={{ background: "var(--sidebar)" }}>
      <div className="p-3 border-b text-sm font-medium flex items-center gap-2"
           style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}>
        <GitBranch className="w-4 h-4" style={{ color: "var(--accent)" }} />
        Git Changes
      </div>

      <div className="flex-1 overflow-auto p-3 space-y-3">
        {data?.untracked?.length > 0 && (
          <div>
            <p className="text-xs font-medium mb-1" style={{ color: "var(--muted-foreground)" }}>
              Untracked ({data.untracked.length})
            </p>
            {data.untracked.slice(0, 20).map((f: string) => (
              <div key={f} className="text-xs px-2 py-1 rounded" style={{ background: "var(--card)", color: "var(--success)", fontFamily: "monospace" }}>
                {f}
              </div>
            ))}
          </div>
        )}

        {data?.diff ? (
          <div>
            <p className="text-xs font-medium mb-1" style={{ color: "var(--muted-foreground)" }}>
              Changes
            </p>
            <pre className="text-xs p-2 rounded overflow-x-auto" style={{ background: "var(--card)", color: "var(--foreground)", fontFamily: "monospace", lineHeight: "1.4" }}>
              {data.diff.slice(0, 2000)}
              {data.diff.length > 2000 && "\n..."}
            </pre>
          </div>
        ) : (
          <p className="text-xs text-center py-8" style={{ color: "var(--muted-foreground)" }}>
            No changes yet
          </p>
        )}
      </div>

      <div className="p-3 border-t space-y-2" style={{ borderColor: "var(--border)" }}>
        <Textarea
          placeholder="Commit message..."
          value={commitMsg}
          onChange={(e) => setCommitMsg(e.target.value)}
          className="text-sm min-h-[60px]"
          style={{ background: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }}
        />
        <div className="flex gap-2">
          <Button size="sm" onClick={handleCommit} disabled={committing || !commitMsg.trim()}
                  style={{ background: "var(--accent)" }} className="flex-1">
            <MessageSquare className="w-3 h-3 mr-1" /> Commit
          </Button>
          <Button size="sm" variant="outline" onClick={handleGeneratePR}
                  style={{ borderColor: "var(--border)", color: "var(--foreground)" }}>
            <GitPullRequest className="w-3 h-3 mr-1" /> PR
          </Button>
        </div>
      </div>

      <Dialog open={prDialog} onOpenChange={setPrDialog}>
        <DialogContent style={{ background: "var(--card)", borderColor: "var(--border)" }}>
          <DialogHeader>
            <DialogTitle style={{ color: "var(--foreground)" }}>Pull Request Preview</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div>
              <p className="text-xs mb-1" style={{ color: "var(--muted-foreground)" }}>Title</p>
              <input
                value={prData?.title || ""}
                onChange={(e) => setPrData({ ...prData, title: e.target.value })}
                className="w-full px-3 py-2 rounded-lg text-sm"
                style={{ background: "var(--background)", border: "1px solid var(--border)", color: "var(--foreground)" }}
              />
            </div>
            <div>
              <p className="text-xs mb-1" style={{ color: "var(--muted-foreground)" }}>Body</p>
              <textarea
                value={prData?.body || ""}
                onChange={(e) => setPrData({ ...prData, body: e.target.value })}
                rows={8}
                className="w-full px-3 py-2 rounded-lg text-sm"
                style={{ background: "var(--background)", border: "1px solid var(--border)", color: "var(--foreground)" }}
              />
            </div>
            <Button onClick={handleSubmitPR} className="w-full" style={{ background: "var(--accent)" }}>
              Submit Pull Request
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
