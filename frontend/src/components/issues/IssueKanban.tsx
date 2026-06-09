"use client";
import { useState } from "react";
import useSWR from "swr";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Clock, GitFork } from "lucide-react";
import { IssueExplainer } from "./IssueExplainer";

const difficultyColors: Record<string, string> = {
  beginner: "bg-green-500/20 text-green-400 border-green-500/30",
  intermediate: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  advanced: "bg-red-500/20 text-red-400 border-red-500/30",
};

const learningColors: Record<string, string> = {
  high: "bg-purple-500/20 text-purple-400",
  medium: "bg-blue-500/20 text-blue-400",
  low: "bg-gray-500/20 text-gray-400",
};

interface IssueKanbanProps {
  workspaceId: number;
}

export function IssueKanban({ workspaceId }: IssueKanbanProps) {
  const { data, error } = useSWR(`/issues/${workspaceId}`, () => api.issues.list(workspaceId));
  const [selectedIssue, setSelectedIssue] = useState<any>(null);
  const [filter, setFilter] = useState("all");

  if (error) {
    return (
      <div className="text-center py-12" style={{ color: "var(--muted-foreground)" }}>
        Failed to load issues. Make sure the repo analysis is complete.
      </div>
    );
  }

  if (!data) {
    return (
      <div className="grid grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="space-y-3">
            <Skeleton className="h-8 w-24" />
            {[1, 2, 3].map((j) => (
              <Skeleton key={j} className="h-32 w-full rounded-lg" />
            ))}
          </div>
        ))}
      </div>
    );
  }

  const issues = data.issues || [];
  const filtered = filter === "all" ? issues : issues.filter((i: any) =>
    i.labels?.some((l: string) => l.toLowerCase().includes(filter))
  );

  const columns: Record<string, any[]> = {
    beginner: [],
    intermediate: [],
    advanced: [],
  };

  filtered.forEach((issue: any) => {
    const col = issue.difficulty || "intermediate";
    if (columns[col]) columns[col].push(issue);
  });

  return (
    <div>
      <div className="flex gap-2 mb-6 flex-wrap">
        {["all", "good first issue", "bug", "enhancement", "help wanted"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
            style={{
              background: filter === f ? "var(--accent)20" : "var(--sidebar)",
              color: filter === f ? "var(--accent)" : "var(--muted-foreground)",
              border: `1px solid ${filter === f ? "var(--accent)40" : "var(--border)"}`,
            }}
          >
            {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Object.entries(columns).map(([difficulty, columnIssues]) => (
          <div key={difficulty}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold capitalize" style={{ color: "var(--foreground)" }}>
                {difficulty}
              </h3>
              <Badge variant="outline" className={difficultyColors[difficulty]}>
                {columnIssues.length}
              </Badge>
            </div>
            <div className="space-y-3">
              {columnIssues.slice(0, 20).map((issue: any) => (
                <Card
                  key={issue.number}
                  className="p-4 cursor-pointer hover:scale-[1.01] transition-transform"
                  style={{ background: "var(--card)", borderColor: "var(--border)" }}
                  onClick={() => setSelectedIssue(issue)}
                >
                  <div className="flex items-start justify-between mb-2">
                    <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                      #{issue.number}
                    </span>
                    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${learningColors[issue.learning_value]}`}>
                      {issue.learning_value}
                    </Badge>
                  </div>
                  <p className="text-sm font-medium mb-2 line-clamp-2" style={{ color: "var(--foreground)" }}>
                    {issue.title}
                  </p>
                  <div className="flex items-center gap-2 flex-wrap">
                    {issue.skills_required?.slice(0, 3).map((s: string) => (
                      <Badge key={s} variant="outline" className="text-[10px]">{s}</Badge>
                    ))}
                    {issue.estimated_hours && (
                      <span className="text-xs flex items-center gap-1 ml-auto" style={{ color: "var(--muted-foreground)" }}>
                        <Clock className="w-3 h-3" />
                        {issue.estimated_hours}h
                      </span>
                    )}
                  </div>
                </Card>
              ))}
              {columnIssues.length === 0 && (
                <p className="text-sm text-center py-8" style={{ color: "var(--muted-foreground)" }}>
                  No issues
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {selectedIssue && (
        <IssueExplainer
          workspaceId={workspaceId}
          issue={selectedIssue}
          onClose={() => setSelectedIssue(null)}
        />
      )}
    </div>
  );
}
