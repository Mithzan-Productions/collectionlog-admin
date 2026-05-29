import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "CollectionLog Admin",
  description: "Admin panel for CollectionLogReloaded player data",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <div className="flex min-h-screen flex-col">
          <header className="border-b">
            <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-6">
              <Link href="/" className="font-mono text-sm font-semibold tracking-tight">
                collectionlog-admin
              </Link>
              <nav className="flex items-center gap-4 text-sm">
                <Link href="/catalog" className="text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]">
                  Catalog
                </Link>
                <Link href="/players" className="text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]">
                  Players
                </Link>
              </nav>
            </div>
          </header>
          <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">{children}</main>
          <footer className="border-t px-6 py-4 text-xs text-[var(--color-fg-muted)]">
            <div className="mx-auto max-w-6xl">
              local dev · backed by <code className="font-mono">mock.db</code>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
