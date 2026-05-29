import type { Metadata } from "next";
import Link from "next/link";
import { Big_Shoulders, Fragment_Mono } from "next/font/google";
import { isMock } from "@/db/client";
import "./globals.css";

const display = Big_Shoulders({
  subsets: ["latin"],
  weight: ["700", "800", "900"],
  variable: "--font-display",
  display: "swap",
});

const mono = Fragment_Mono({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "CollectionLog · Operator",
  description: "Operator console for CollectionLogReloaded player data",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${mono.variable}`}>
      <body className="min-h-screen">
        <div className="relative z-10 flex min-h-screen flex-col">
          <header className="border-b border-[var(--color-rule-2)]">
            <div className="mx-auto flex max-w-[1200px] items-stretch px-6">
              <Link href="/" className="group flex items-center gap-3 py-4 pr-8 border-r border-[var(--color-rule-2)]">
                <span
                  aria-hidden
                  className="display text-[28px] leading-none text-[var(--color-lime)] transition group-hover:tracking-wider"
                >
                  CL/
                </span>
                <span className="flex flex-col leading-none">
                  <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--color-fg-dim)]">
                    collectionlog
                  </span>
                  <span className="text-[13px] text-[var(--color-fg)]">operator</span>
                </span>
              </Link>
              <nav className="flex items-stretch">
                <NavLink href="/catalog" label="catalog" hint="C-01" />
                <NavLink href="/players" label="players" hint="P-01" />
              </nav>
              <div className="ml-auto flex items-center gap-3 text-[10px] uppercase tracking-[0.2em] text-[var(--color-fg-dim)]">
                <span className="flex items-center gap-1.5">
                  <span
                    className={
                      "inline-block h-1.5 w-1.5 shimmer " +
                      (isMock ? "bg-[var(--color-amber)]" : "bg-[var(--color-lime)]")
                    }
                  />
                  {isMock ? "mock.db" : "live"}
                </span>
                <span className="hidden sm:inline">·</span>
                <span className="hidden font-mono sm:inline">v0.1.0</span>
              </div>
            </div>
          </header>

          <main className="mx-auto w-full max-w-[1200px] flex-1 px-6 py-10">{children}</main>

          <footer className="border-t border-[var(--color-rule-2)] px-6 py-6">
            <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-4 text-[10px] uppercase tracking-[0.2em] text-[var(--color-fg-dim)]">
              <span>
                <span className="text-[var(--color-fg-muted)]">collectionlog-admin</span>
                {isMock && (
                  <>
                    <span className="mx-2">·</span>
                    local · backed by{" "}
                    <code className="font-mono text-[var(--color-vellum)]">mock.db</code>
                  </>
                )}
              </span>
              <span className="font-mono">
                NS={process.env.COLLECTIONLOG_NAMESPACE ?? "collectionlog"}
              </span>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}

function NavLink({ href, label, hint }: { href: string; label: string; hint: string }) {
  return (
    <Link
      href={href as never}
      className="group relative flex flex-col justify-center border-r border-[var(--color-rule-2)] px-5 py-4 text-[var(--color-fg-muted)] transition hover:bg-[var(--color-paper)] hover:text-[var(--color-fg)]"
    >
      <span className="text-[9px] uppercase tracking-[0.22em] text-[var(--color-fg-dim)] transition group-hover:text-[var(--color-lime)]">
        {hint}
      </span>
      <span className="font-mono text-sm">{label}</span>
    </Link>
  );
}
