"use client";
import useSWR from "swr";
import { api } from "@/lib/api";

export function useAuth() {
  const hasToken = typeof window !== "undefined" ? !!localStorage.getItem("session_token") : false;
  const { data: user, error, mutate } = useSWR(
    hasToken ? "/auth/me" : null,
    () => api.auth.me(),
    { shouldRetryOnError: false },
  );
  return {
    user,
    isLoading: hasToken && !user && !error,
    isAuthenticated: !!user,
    mutate,
    signout: async () => {
      try { await api.auth.signout(); } catch {}
      localStorage.removeItem("session_token");
      mutate(null);
      window.location.href = "/";
    },
  };
}
