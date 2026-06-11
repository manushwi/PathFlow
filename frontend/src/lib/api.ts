const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function apiFetch(path: string, options?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Request failed" }));
    throw new Error(err.detail || "Request failed");
  }
  return res.json();
}

export const api = {
  auth: {
    me: () => apiFetch("/api/auth/me"),
    signout: () => apiFetch("/api/auth/signout", { method: "POST" }),
    updateSkill: (skill_level: string) =>
      apiFetch("/api/auth/skill", { method: "PATCH", body: JSON.stringify({ skill_level }) }),
  },
  workspace: {
    list: () => apiFetch("/api/workspace"),
    create: (repo_url: string) =>
      apiFetch("/api/workspace", { method: "POST", body: JSON.stringify({ repo_url }) }),
    get: (id: number) => apiFetch(`/api/workspace/${id}`),
    status: (id: number) => apiFetch(`/api/workspace/${id}/status`),
    delete: (id: number) => apiFetch(`/api/workspace/${id}`, { method: "DELETE" }),
    reanalyze: (id: number) => apiFetch(`/api/workspace/${id}/reanalyze`, { method: "POST" }),
  },
  issues: {
    list: (workspaceId: number) => apiFetch(`/api/workspace/${workspaceId}/issues`),
    explain: (workspaceId: number, issueNumber: number) =>
      apiFetch(`/api/workspace/${workspaceId}/issues/${issueNumber}/explain`),
  },
  files: {
    tree: (workspaceId: number) => apiFetch(`/api/workspace/${workspaceId}/files`),
    content: (workspaceId: number, path: string) =>
      apiFetch(`/api/workspace/${workspaceId}/files/content?path=${encodeURIComponent(path)}`),
    saveOpenFiles: (workspaceId: number, files: any[]) =>
      apiFetch(`/api/workspace/${workspaceId}/files/open-files`, {
        method: "POST", body: JSON.stringify({ files }) }),
    getOpenFiles: (workspaceId: number) =>
      apiFetch(`/api/workspace/${workspaceId}/files/open-files`),
    save: (workspaceId: number, path: string, content: string) =>
      apiFetch(`/api/workspace/${workspaceId}/files/content`, {
        method: "POST", body: JSON.stringify({ path, content }) }),
  },
  ai: {
    chatHistory: (workspaceId: number) => apiFetch(`/api/ai/chat/${workspaceId}/history`),
    solveIssue: (workspaceId: number, issueNumber: number) =>
      apiFetch("/api/ai/solve-issue", { method: "POST",
        body: JSON.stringify({ workspace_id: workspaceId, issue_number: issueNumber }) }),
  },
  terminal: {
    exec: (workspaceId: number, command: string) =>
      apiFetch("/api/terminal/exec", { method: "POST",
        body: JSON.stringify({ workspace_id: workspaceId, command }) }),
  },
  git: {
    diff: (workspaceId: number) => apiFetch(`/api/git/diff/${workspaceId}`),
    commit: (workspaceId: number, message: string) =>
      apiFetch("/api/git/commit", { method: "POST",
        body: JSON.stringify({ workspace_id: workspaceId, message }) }),
    generatePR: (workspaceId: number, issueNumber: number, diff: string) =>
      apiFetch("/api/git/pr/generate", { method: "POST",
        body: JSON.stringify({ workspace_id: workspaceId, issue_number: issueNumber, diff }) }),
    createPR: (workspaceId: number, title: string, body: string) =>
      apiFetch("/api/git/pr/create", { method: "POST",
        body: JSON.stringify({ workspace_id: workspaceId, title, body }) }),
    createBranch: (workspaceId: number, branchName: string) =>
      apiFetch("/api/git/branch", { method: "POST",
        body: JSON.stringify({ workspace_id: workspaceId, name: branchName }) }),
  },
};
