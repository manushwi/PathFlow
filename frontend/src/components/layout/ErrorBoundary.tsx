"use client";
import { Component, ReactNode } from "react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="flex flex-col items-center justify-center min-h-[200px] p-6"
             style={{ background: "var(--background)" }}>
          <p className="text-lg font-semibold mb-2" style={{ color: "var(--danger)" }}>
            Something went wrong
          </p>
          <p className="text-sm mb-4" style={{ color: "var(--muted-foreground)" }}>
            {this.state.error?.message || "An unexpected error occurred"}
          </p>
          <Button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{ background: "var(--accent)" }}
          >
            Try Again
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}