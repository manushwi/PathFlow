"use client";
import { useState } from "react";
import useSWR from "swr";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, LogOut, GitBranch, Clock } from "lucide-react";

const statusColors: Record<string, string> = {
  pending: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  cloning: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  analyzing: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  embedding: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  generating_docs: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  building_graph: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  ready: "bg-green-500/20 text-green-400 border-green-500/30",
  error: "bg-red-500/20 text-red-400 border-red-500/30",
};

export default function DashboardPage() {
  const { user, isLoading, isAuthenticated, signout } = useAuth();
  const { data: workspaces, mutate: refreshWorkspaces } = useSWR("/workspaces", () => api.workspace.list());
  const [newUrl, setNewUrl] = useState("");
  const [creating, setCreating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--background)" }}>
        <div className="animate-spin w-8 h-8 border-2 rounded-full" style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }} />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--background)" }}>
        <p style={{ color: "var(--muted-foreground)" }}>Redirecting to login...</p>
      </div>
    );
  }

  const handleCreate = async () => {
    if (!newUrl.trim()) return;
    setCreating(true);
    try {
      await api.workspace.create(newUrl.trim());
      setNewUrl("");
      setDialogOpen(false);
      refreshWorkspaces();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      <header className="border-b px-6 py-4 flex items-center justify-between"
              style={{ background: "var(--sidebar)", borderColor: "var(--border)" }}>
        <div className="flex items-center gap-3">
          <span className="text-xl font-bold" style={{ color: "var(--accent)" }}>PatchFlow</span>
        </div>
        <div className="flex items-center gap-4">
          <Badge variant="outline" style={{ borderColor: "var(--accent)40", color: "var(--accent)" }}>
            {user?.skill_level}
          </Badge>
          <div className="flex items-center gap-2">
            {user?.avatar_url && (
              <img src={user.avatar_url} alt="" className="w-8 h-8 rounded-full" />
            )}
            <span className="text-sm" style={{ color: "var(--foreground)" }}>{user?.login}</span>
          </div>
          <Button variant="ghost" size="sm" onClick={signout}>
            <LogOut className="w-4 h-4 mr-1" /> Sign out
          </Button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>My Workspaces</h1>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger>
              <Button style={{ background: "var(--accent)" }}>
                <Plus className="w-4 h-4 mr-2" /> New Workspace
              </Button>
            </DialogTrigger>
            <DialogContent style={{ background: "var(--card)", borderColor: "var(--border)" }}>
              <DialogHeader>
                <DialogTitle style={{ color: "var(--foreground)" }}>Add Repository</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <Input
                  placeholder="https://github.com/owner/repo"
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                  style={{ background: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }}
                />
                <Button onClick={handleCreate} disabled={creating} className="w-full" style={{ background: "var(--accent)" }}>
                  {creating ? "Creating..." : "Create Workspace"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {!workspaces ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} style={{ background: "var(--card)", borderColor: "var(--border)" }}>
                <CardHeader><Skeleton className="h-5 w-48" /></CardHeader>
                <CardContent><Skeleton className="h-4 w-32" /></CardContent>
              </Card>
            ))}
          </div>
        ) : workspaces.length === 0 ? (
          <div className="text-center py-20" style={{ color: "var(--muted-foreground)" }}>
            <GitBranch className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p className="text-lg mb-2">No workspaces yet</p>
            <p className="text-sm">Add your first repository to get started</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {workspaces.map((ws: any) => (
              <a key={ws.id} href={`/workspace/${ws.id}/explore`} className="block">
                <Card className="hover:scale-[1.02] transition-transform cursor-pointer"
                      style={{ background: "var(--card)", borderColor: "var(--border)" }}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2" style={{ color: "var(--foreground)" }}>
                      <GitBranch className="w-4 h-4" style={{ color: "var(--accent)" }} />
                      {ws.repo_owner}/{ws.repo_name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className={statusColors[ws.status] || ""}>
                        {ws.status}
                      </Badge>
                      <span className="text-xs flex items-center gap-1" style={{ color: "var(--muted-foreground)" }}>
                        <Clock className="w-3 h-3" />
                        {new Date(ws.last_active).toLocaleDateString()}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </a>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
