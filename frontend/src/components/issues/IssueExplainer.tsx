"use client";
import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, FileCode, BookOpen, Lightbulb } from "lucide-react";

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
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.issues.explain(workspaceId, issue.number)
      .then((res) => setData(res))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [workspaceId, issue.number]);

  return (
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
              <Button style={{ background: "var(--accent)" }}>
                Open in IDE
              </Button>
              <Button variant="outline" style={{ borderColor: "var(--border)", color: "var(--foreground)" }}>
                Solve with AI
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
  );
}
