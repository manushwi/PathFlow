"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Search,
  Bell,
  Settings,
  LayoutDashboard,
  GitBranch,
  Columns3,
  Code2,
  Terminal,
  FileText,
  LogOut,
  Plus,
  MoreVertical,
  RotateCcw,
  GitFork,
  GitMerge,
  CheckCircle,
  BarChart3,
  History,
  ArrowRight,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import useSWR from "swr";
import { api, apiFetch } from "@/lib/api";
import { SkillDialog } from "@/components/dashboard/SkillDialog";
import { toast } from "sonner";

export default function Dashboard() {
  const { user, isLoading: authLoading, isAuthenticated, signout } = useAuth();
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [repoUrl, setRepoUrl] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  const { data: workspaces, mutate: refreshWorkspaces } = useSWR(
    isAuthenticated ? "/workspace" : null,
    () => api.workspace.list(),
  );

  const { data: activity } = useSWR(
    isAuthenticated ? "/activity" : null,
    () => apiFetch("/api/activity"),
  );

  const handleCreate = async () => {
    if (!repoUrl.trim()) return;
    setCreating(true);
    setCreateError("");
    try {
      const ws = await api.workspace.create(repoUrl.trim());
      setCreateOpen(false);
      setRepoUrl("");
      refreshWorkspaces();
      toast.success("Workspace created", { description: "Analysis pipeline started" });
      router.push(`/workspace/${ws.id}`);
    } catch (e: any) {
      setCreateError(e.message || "Failed to create workspace");
      toast.error("Failed to create workspace", { description: e.message });
    } finally {
      setCreating(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a]">
        <Loader2 className="h-8 w-8 animate-spin text-[#adc6ff]" />
      </div>
    );
  }

  const displayActivity = Array.isArray(activity) ? activity : [];

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#0a0a0a" }}>
      {/* Top Nav Bar */}
      <header className="sticky top-0 z-50 flex h-14 w-full items-center justify-between border-b border-white/10 bg-[#0a0a0a]/80 px-6 backdrop-blur-xl">
        <div className="flex items-center gap-8">
          <span className="text-lg font-semibold tracking-tighter text-[#e1e2ec]">
            PatchFlow
          </span>
          <div className="relative hidden w-96 md:block">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#c2c6d6]" />
            <input
              className="w-full rounded-lg border border-white/10 bg-[#32353c]/30 py-1.5 pl-10 pr-4 text-sm text-[#e1e2ec] outline-none placeholder:text-[#c2c6d6]/50 focus:border-[#adc6ff] focus:ring-1 focus:ring-[#adc6ff] transition-all"
              placeholder="Search workspaces..."
              type="text"
            />
          </div>
        </div>
        <nav className="flex items-center gap-4">
          <button className="rounded-lg p-2 text-[#c2c6d6] transition-colors hover:bg-[#32353c]/50">
            <Bell className="h-5 w-5" />
          </button>
          <button className="rounded-lg p-2 text-[#c2c6d6] transition-colors hover:bg-[#32353c]/50">
            <Settings className="h-5 w-5" />
          </button>
          <div className="mx-1 h-8 w-px bg-[#424754]/30" />
          <Avatar className="h-8 w-8 rounded-lg border border-[#424754]/30">
            <AvatarImage src={user?.avatar_url} />
            <AvatarFallback>{user?.login?.charAt(0).toUpperCase() || "U"}</AvatarFallback>
          </Avatar>
        </nav>
      </header>

      <div className="flex min-h-[calc(100vh-3.5rem)]">
        {/* Sidebar */}
        <aside className="fixed left-0 top-14 z-40 flex h-[calc(100vh-3.5rem)] w-16 flex-col border-r border-[#424754]/20 bg-[#0b0e15] md:w-64">
          <div className="flex flex-col gap-1 p-4">
            <SidebarItem icon={LayoutDashboard} label="Dashboard" active onClick={() => router.push("/dashboard")} />
            <SidebarItem icon={GitBranch} label="Explainer" onClick={() => workspaces?.[0] && router.push(`/workspace/${workspaces[0].id}`)} />
            <SidebarItem icon={Columns3} label="Issues" onClick={() => workspaces?.[0] && router.push(`/workspace/${workspaces[0].id}/issues`)} />
            <SidebarItem icon={Code2} label="Editor" onClick={() => workspaces?.[0] && router.push(`/workspace/${workspaces[0].id}`)} />
            <SidebarItem icon={Terminal} label="Terminal" onClick={() => workspaces?.[0] && router.push(`/workspace/${workspaces[0].id}?tab=terminal`)} />
          </div>
          <div className="mt-auto border-t border-[#424754]/10 p-4">
            <SidebarItem icon={FileText} label="Docs" />
            <SidebarItem icon={LogOut} label="Sign Out" error onClick={signout} />
          </div>
        </aside>

        {/* Main Content */}
        <main className="ml-16 flex-1 bg-[#10131a] p-6 md:ml-64">
          {/* Header */}
          <div className="mb-12 flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
            <div>
              <h1 className="text-[32px] font-semibold tracking-tight text-[#e1e2ec]">
                My Workspaces
              </h1>
              <p className="text-sm text-[#c2c6d6]">
                Active development environments and AI agents.
              </p>
            </div>
            <Button
              onClick={() => setCreateOpen(true)}
              className="flex items-center gap-2 bg-[#adc6ff] text-[#001a42] hover:brightness-110 active:scale-95"
            >
              <Plus className="h-5 w-5" />
              Create Workspace
            </Button>
          </div>

          <div className="flex flex-col gap-6 lg:flex-row">
            {/* Workspace Grid */}
            <div className="flex-1">
              {!workspaces ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="h-6 w-6 animate-spin text-[#c2c6d6]" />
                </div>
              ) : workspaces.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-white/10 py-20">
                  <Code2 className="mb-4 h-12 w-12 text-[#c2c6d6]/40" />
                  <p className="text-lg text-[#c2c6d6]">No workspaces yet</p>
                  <p className="mt-1 text-sm text-[#c2c6d6]/60">
                    Create a workspace to start contributing
                  </p>
                  <Button
                    onClick={() => setCreateOpen(true)}
                    className="mt-6 flex items-center gap-2 bg-[#adc6ff] text-[#001a42]"
                  >
                    <Plus className="h-4 w-4" />
                    Create Your First Workspace
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {workspaces.map((ws: any) => (
                    <GlassCard
                      key={ws.id}
                      onClick={() => router.push(`/workspace/${ws.id}`)}
                    >
                      <div className="flex items-center gap-4">
                        <div className="rounded-lg bg-blue-500/10 p-2">
                          <RotateCcw className="h-5 w-5 text-blue-400" />
                        </div>
                        <h3 className="truncate text-[18px] font-semibold text-[#e1e2ec]">
                          {ws.repo_owner}/{ws.repo_name}
                        </h3>
                      </div>
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center justify-between text-sm text-[#c2c6d6]">
                          <span className="font-mono">{ws.branch}</span>
                          <Badge
                            className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${
                              ws.status === "ready"
                                ? "border-green-500/20 bg-green-500/10 text-green-500"
                                : ws.status === "pending"
                                  ? "border-yellow-500/20 bg-yellow-500/10 text-yellow-500"
                                  : "border-gray-500/20 bg-gray-500/10 text-gray-400"
                            }`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${
                                ws.status === "ready"
                                  ? "bg-green-500"
                                  : ws.status === "pending"
                                    ? "bg-yellow-500"
                                    : "bg-gray-500"
                              }`}
                            />
                            {ws.status}
                          </Badge>
                        </div>
                      </div>
                      <div className="mt-auto flex items-center justify-between border-t border-[#424754]/10 pt-4">
                        <span className="text-[12px] text-[#c2c6d6]">
                          {ws.last_active
                            ? new Date(ws.last_active).toLocaleDateString()
                            : "Just now"}
                        </span>
                        <ExternalLink className="h-4 w-4 text-[#c2c6d6]/60" />
                      </div>
                    </GlassCard>
                  ))}
                </div>
              )}
            </div>

            {/* Right Sidebar: Stats & Activity */}
            <aside className="flex w-full flex-col gap-6 lg:w-80">
              {/* User Info */}
              {user && (
                <GlassCard>
                  <div className="flex items-center gap-4">
                    <Avatar className="h-12 w-12 rounded-lg">
                      <AvatarImage src={user.avatar_url} />
                      <AvatarFallback>{user.login?.charAt(0).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-semibold text-[#e1e2ec]">{user.name || user.login}</p>
                      <p className="text-xs text-[#c2c6d6]">Skill: {user.skill_level}</p>
                    </div>
                  </div>
                </GlassCard>
              )}

              {/* Quick Stats */}
              <GlassCard>
                <h4 className="flex items-center gap-2 text-[16px] font-semibold text-[#e1e2ec]">
                  <BarChart3 className="h-5 w-5" />
                  Quick Stats
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg border border-[#424754]/10 bg-[#1d2027]/50 p-4">
                    <span className="mb-1 block text-[12px] text-[#c2c6d6]">Active</span>
                    <span className="text-[24px] font-bold text-green-500">
                      {workspaces?.filter((w: any) => w.status === "ready").length || 0}
                    </span>
                  </div>
                  <div className="rounded-lg border border-[#424754]/10 bg-[#1d2027]/50 p-4">
                    <span className="mb-1 block text-[12px] text-[#c2c6d6]">Total</span>
                    <span className="text-[24px] font-bold text-[#adc6ff]">
                      {workspaces?.length || 0}
                    </span>
                  </div>
                </div>
              </GlassCard>

              {/* Recent Activity */}
              <GlassCard>
                <h4 className="flex items-center gap-2 text-[16px] font-semibold text-[#e1e2ec]">
                  <History className="h-5 w-5" />
                  Recent Activity
                </h4>
                <div className="mt-2 flex flex-col gap-6">
                  {displayActivity.length === 0 ? (
  <p className="text-sm text-center py-6" style={{ color: "var(--muted-foreground)" }}>
    No recent activity. Create a workspace to get started.
  </p>
) : displayActivity.map((item: any, i: number) => (
                    <div key={i} className="flex gap-4">
                      <div className="relative flex flex-col items-center">
                        <div className="h-2.5 w-2.5 rounded-full bg-[#adc6ff]" />
                        {i < displayActivity.length - 1 && (
                          <div className="h-full w-px bg-[#424754]/20" />
                        )}
                      </div>
                      <div className="-mt-1 flex flex-col gap-1">
                        <p className="text-sm leading-tight text-[#e1e2ec]">
                          {item.text}
                          {item.repo && (
                            <span className="font-mono text-[#adc6ff]"> {item.repo}</span>
                          )}
                        </p>
                        <span className="text-[12px] text-[#c2c6d6]">
                          {item.timestamp ? new Date(item.timestamp).toLocaleDateString() : "recent"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </GlassCard>
            </aside>
          </div>
        </main>
      </div>

      {/* Create Workspace Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="w-full max-w-md border border-white/10 bg-[#14141b] text-[#e1e2ec] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-[#e1e2ec]">
              Create Workspace
            </DialogTitle>
            <DialogDescription className="text-sm text-[#c2c6d6]">
              Enter a GitHub repository URL to get started.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <Input
              placeholder="https://github.com/facebook/react"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              className="border-white/10 bg-[#1d2027] text-[#e1e2ec] placeholder:text-[#c2c6d6]/50 focus:border-[#adc6ff]"
            />
            {createError && (
              <p className="text-sm text-red-400">{createError}</p>
            )}
          </div>
          <div className="flex justify-end gap-3">
            <DialogClose className="rounded-lg border border-white/10 bg-transparent px-4 py-2 text-sm text-[#c2c6d6] transition-colors hover:bg-white/5">
              Cancel
            </DialogClose>
            <Button
              onClick={handleCreate}
              disabled={creating || !repoUrl.trim()}
              className="bg-[#adc6ff] text-[#001a42] hover:brightness-110"
            >
              {creating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <SkillDialog />
    </div>
  );
}

function SidebarItem({
  icon: Icon,
  label,
  active,
  error,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  active?: boolean;
  error?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-4 rounded-lg p-2 text-sm transition-all duration-150 ease-in-out ${
        active
          ? "border-r-2 border-green-500 bg-green-500/10 text-green-500"
          : error
            ? "text-[#c2c6d6] hover:bg-[#32353c]/30 hover:text-red-500"
            : "text-[#c2c6d6] hover:bg-[#32353c]/30 hover:text-[#e1e2ec]"
      }`}
    >
      <Icon className="h-5 w-5 shrink-0" />
      <span className="hidden md:block">{label}</span>
    </button>
  );
}

function GlassCard({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <Card
      onClick={onClick}
      className={`group relative flex flex-col gap-4 rounded-xl border border-white/10 bg-[#14141b]/50 p-6 backdrop-blur-sm transition-all duration-300 hover:border-[#adc6ff]/30 hover:-translate-y-0.5 hover:bg-[#14141b]/70 ${
        onClick ? "cursor-pointer" : ""
      }`}
      style={{ boxShadow: "0 0 20px -5px rgba(59, 130, 246, 0.4)" }}
    >
      {children}
    </Card>
  );
}
