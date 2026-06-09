"use client";
import { useParams } from "next/navigation";
import useSWR from "swr";
import { api } from "@/lib/api";
import { IssueKanban } from "@/components/issues/IssueKanban";
import { ArrowLeft, GitBranch } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function IssuesPage() {
  const params = useParams();
  const workspaceId = Number(params.id);
  const { data: ws } = useSWR(`/workspace/${workspaceId}`, () => api.workspace.get(workspaceId));

  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      <header className="border-b px-6 py-3 flex items-center gap-4"
              style={{ background: "var(--sidebar)", borderColor: "var(--border)" }}>
        <a href={`/workspace/${workspaceId}/explore`} style={{ color: "var(--muted-foreground)" }}>
          <ArrowLeft className="w-5 h-5" />
        </a>
        <GitBranch className="w-5 h-5" style={{ color: "var(--accent)" }} />
        <span className="font-semibold" style={{ color: "var(--foreground)" }}>
          {ws?.repo_owner}/{ws?.repo_name} — Issues
        </span>
        <Badge variant="outline" className="ml-auto" style={{ borderColor: "var(--accent)40", color: "var(--accent)" }}>
          {ws?.branch}
        </Badge>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <IssueKanban workspaceId={workspaceId} />
      </main>
    </div>
  );
}
