"use client";
export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center"
         style={{ background: "var(--background)" }}>
      <div className="text-center max-w-2xl px-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs mb-8"
             style={{ background: "var(--accent)20", color: "var(--accent)", border: "1px solid var(--accent)40" }}>
          ✦ AI-Powered Open Source Workspace
        </div>
        <h1 className="text-6xl font-bold mb-6" style={{ color: "var(--foreground)" }}>
          Contribute to<br />
          <span style={{ color: "var(--accent)" }}>Open Source</span><br />
          with AI
        </h1>
        <p className="text-lg mb-10" style={{ color: "var(--muted-foreground)" }}>
          Understand any repository, find the right issues for your skill level,
          and ship pull requests — all from your browser.
        </p>
        <a href={`${process.env.NEXT_PUBLIC_API_URL}/api/auth/github`}
           className="inline-flex items-center gap-3 px-8 py-4 rounded-xl text-white font-semibold text-lg transition-all hover:scale-105"
           style={{ background: "var(--accent)" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
          </svg>
          Continue with GitHub
        </a>
      </div>
    </div>
  );
}
