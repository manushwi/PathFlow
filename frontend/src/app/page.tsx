"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Code2, GitPullRequest, Sparkles, Loader2, Search } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export default function LandingPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isAuthenticated) router.push("/dashboard");
  }, [isAuthenticated, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ backgroundColor: "#0a0a0a" }}>
        <Loader2 className="h-8 w-8 animate-spin text-[#adc6ff]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#0a0a0a", color: "#e1e2ec" }}>
      <header className="flex h-14 items-center justify-between border-b border-white/10 bg-[#0a0a0a]/80 px-6 backdrop-blur-xl">
        <span className="text-lg font-semibold tracking-tighter">PatchFlow</span>
        <div className="flex items-center gap-4">
          <a href="/dashboard" className="text-sm text-[#c2c6d6] transition-colors hover:text-[#e1e2ec]">Dashboard</a>
          <a href={`${process.env.NEXT_PUBLIC_API_URL}/api/auth/github`}
             className="rounded-lg bg-[#adc6ff] px-4 py-1.5 text-sm font-medium text-[#001a42] transition-all hover:brightness-110">
            Sign In
          </a>
        </div>
      </header>

      <section className="relative flex flex-col items-center justify-center px-6 pt-32 pb-24 text-center">
        <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-[#adc6ff]/20 bg-[#adc6ff]/5 px-3 py-1 text-xs text-[#adc6ff]">
          <Sparkles className="h-3.5 w-3.5" />
          AI-Powered Open Source Workspace
        </div>
        <h1 className="max-w-4xl text-5xl font-bold tracking-tight sm:text-6xl md:text-7xl">
          Contribute to<br />
          <span style={{ color: "#adc6ff" }}>Open Source</span><br />
          with AI
        </h1>
        <p className="mt-6 max-w-xl text-lg text-[#c2c6d6]">
          Understand any repository, find the right issues for your skill level,
          and ship pull requests — all from your browser.
        </p>
        <div className="mt-10 flex items-center gap-4">
          <a
            href={`${process.env.NEXT_PUBLIC_API_URL}/api/auth/github`}
            className="inline-flex items-center gap-3 rounded-xl px-8 py-4 text-lg font-semibold text-[#001a42] transition-all hover:scale-105"
            style={{ backgroundColor: "#adc6ff", boxShadow: "0 0 30px -5px rgba(173, 198, 255, 0.4)" }}
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/></svg>
            Continue with GitHub
          </a>
          <a
            href="#features"
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-8 py-4 text-lg font-semibold text-[#e1e2ec] transition-all hover:bg-white/5"
          >
            Learn More <ArrowRight className="h-5 w-5" />
          </a>
        </div>

        <div className="pointer-events-none absolute -top-40 left-1/2 h-[600px] w-[600px] -translate-x-1/2 rounded-full opacity-20 blur-[120px]" style={{ background: "radial-gradient(circle, #adc6ff 0%, transparent 70%)" }} />
      </section>

      <section id="features" className="mx-auto max-w-6xl px-6 pb-32">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <FeatureCard icon={Search} title="Understand Any Repo" description="AI-powered code analysis explains architecture, dependencies, and logic in plain language." />
          <FeatureCard icon={GitPullRequest} title="Find the Right Issues" description="Smart issue matching based on your skill level, interests, and experience." />
          <FeatureCard icon={Code2} title="Ship with AI Agents" description="Collaborate with AI agents that help you write, test, and submit pull requests." />
        </div>
      </section>

      <section className="border-t border-white/10 px-6 py-24 text-center">
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Ready to start contributing?</h2>
        <p className="mt-4 text-lg text-[#c2c6d6]">Join developers who use PatchFlow to make their first open source contribution.</p>
        <a href={`${process.env.NEXT_PUBLIC_API_URL}/api/auth/github`}
           className="mt-8 inline-flex items-center gap-3 rounded-xl px-8 py-4 text-lg font-semibold text-[#001a42] transition-all hover:scale-105"
           style={{ backgroundColor: "#adc6ff", boxShadow: "0 0 30px -5px rgba(173, 198, 255, 0.4)" }}>
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/></svg>
          Get Started Free
        </a>
      </section>

      <footer className="border-t border-white/10 px-6 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 md:flex-row">
          <p className="text-sm text-[#c2c6d6]">© 2024 PatchFlow AI. Open Source under MIT.</p>
          <div className="flex gap-6 text-sm text-[#c2c6d6]">
            <a href="#" className="transition-colors hover:text-[#adc6ff]">Privacy</a>
            <a href="#" className="transition-colors hover:text-[#adc6ff]">Terms</a>
            <a href="#" className="transition-colors hover:text-[#adc6ff]">GitHub</a>
            <a href="#" className="transition-colors hover:text-[#adc6ff]">Discord</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon: Icon, title, description }: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <div className="group rounded-xl border border-white/10 bg-[#14141b]/50 p-8 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-[#adc6ff]/30 hover:bg-[#14141b]/70"
         style={{ boxShadow: "0 0 20px -5px rgba(59, 130, 246, 0.2)" }}>
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-[#adc6ff]/10">
        <Icon className="h-6 w-6 text-[#adc6ff]" />
      </div>
      <h3 className="mb-2 text-lg font-semibold text-[#e1e2ec]">{title}</h3>
      <p className="text-sm leading-relaxed text-[#c2c6d6]">{description}</p>
    </div>
  );
}
