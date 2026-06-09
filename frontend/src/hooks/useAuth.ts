"use client";
import useSWR from "swr";
import { api } from "@/lib/api";

export function useAuth() {
  const { data: user, error, mutate } = useSWR("/auth/me", () => api.auth.me(), {
    shouldRetryOnError: false,
  });
  return {
    user,
    isLoading: !user && !error,
    isAuthenticated: !!user,
    signout: async () => {
      await api.auth.signout();
      mutate(null);
      window.location.href = "/";
    },
  };
}
