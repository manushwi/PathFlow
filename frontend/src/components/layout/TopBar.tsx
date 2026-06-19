"use client";
import { useAuth } from "@/hooks/useAuth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useRouter } from "next/navigation";
import { Search, Bell, Settings, LogOut, ChevronLeft, GitBranch } from "lucide-react";

interface TopBarProps {
  workspaceName?: string;
  branch?: string;
  showBack?: boolean;
}

export function TopBar({ workspaceName, branch, showBack }: TopBarProps) {
  const { user, signout } = useAuth();
  const router = useRouter();

  return (
    <header className="sticky top-0 z-50 flex h-14 w-full items-center justify-between border-b px-6"
            style={{ borderColor: "var(--border)", background: "var(--sidebar)/80", backdropFilter: "blur-xl" }}>
      <div className="flex items-center gap-4">
        {showBack && (
          <button onClick={() => router.push("/dashboard")} style={{ color: "var(--muted-foreground)" }}>
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}
        <span className="text-lg font-semibold tracking-tighter" style={{ color: "var(--foreground)" }}
              onClick={() => router.push("/dashboard")}>
          PathFlow
        </span>
        {workspaceName && (
          <>
            <span className="text-sm" style={{ color: "var(--muted-foreground)" }}>/</span>
            <span className="text-sm font-medium flex items-center gap-1.5" style={{ color: "var(--accent)" }}>
              <GitBranch className="w-3.5 h-3.5" />
              {workspaceName}
            </span>
          </>
        )}
        {branch && (
          <Badge variant="outline" className="text-xs" style={{ borderColor: "var(--accent)40", color: "var(--accent)" }}>
            {branch}
          </Badge>
        )}
      </div>

      <div className="flex items-center gap-3">
        {!workspaceName && (
          <div className="relative hidden md:block">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: "var(--muted-foreground)" }} />
            <input
              className="w-64 rounded-lg border py-1.5 pl-10 pr-4 text-sm outline-none transition-all"
              style={{
                background: "var(--background)",
                borderColor: "var(--border)",
                color: "var(--foreground)",
              }}
              placeholder="Search workspaces..."
              type="text"
            />
          </div>
        )}
        <button className="rounded-lg p-2 transition-colors hover:bg-white/5"
                style={{ color: "var(--muted-foreground)" }}>
          <Bell className="h-5 w-5" />
        </button>
        <button className="rounded-lg p-2 transition-colors hover:bg-white/5"
                style={{ color: "var(--muted-foreground)" }}>
          <Settings className="h-5 w-5" />
        </button>
        <div className="mx-1 h-8 w-px" style={{ background: "var(--border)" }} />
        <div className="flex items-center gap-2">
          <Avatar className="h-8 w-8 rounded-lg border" style={{ borderColor: "var(--border)" }}>
            <AvatarImage src={user?.avatar_url} />
            <AvatarFallback>{user?.login?.charAt(0).toUpperCase() || "U"}</AvatarFallback>
          </Avatar>
          {user?.skill_level && (
            <Badge variant="outline" className="hidden md:inline-flex text-xs">
              {user.skill_level}
            </Badge>
          )}
        </div>
        <button
          onClick={signout}
          className="rounded-lg p-2 transition-colors hover:bg-white/5"
          style={{ color: "var(--muted-foreground)" }}
          title="Sign Out"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}