import Link from "next/link";
import { revalidatePath } from "next/cache";
import { LogIn, LogOut } from "lucide-react";
import type { Session } from "next-auth";
import { signIn, signOut, devSignIn, devSignOut } from "@/auth";

export function AuthControl({ session }: { session: Session | null }) {
  const devMode = process.env.NEXTAUTH_DEV_BYPASS === "1";

  // ── Signed out ─────────────────────────────────────────────────────────────
  if (!session?.user) {
    return (
      <form
        action={async () => {
          "use server";
          if (devMode) {
            await devSignIn("admin");
            revalidatePath("/", "layout");
          } else {
            await signIn("discord");
          }
        }}
      >
        <button
          type="submit"
          className="inline-flex items-center gap-1.5 border border-[var(--color-rule-2)] bg-[var(--color-paper)] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-fg-muted)] transition hover:border-[var(--color-lime)] hover:text-[var(--color-lime)]"
          title={devMode ? "dev: sign in as admin (cookie)" : "sign in with Discord"}
        >
          <LogIn className="h-3 w-3" />
          sign in
        </button>
      </form>
    );
  }

  // ── Signed in ──────────────────────────────────────────────────────────────
  const isAdmin = Boolean(session.user.isAdmin);
  const name = session.user.name ?? session.user.email ?? "user";
  const avatar = session.user.image;

  return (
    <form
      action={async () => {
        "use server";
        if (devMode) {
          await devSignOut();
          revalidatePath("/", "layout");
        } else {
          await signOut();
        }
      }}
      className="inline-flex items-center gap-2"
    >
      {avatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatar}
          alt=""
          className="h-5 w-5 border border-[var(--color-rule-2)]"
          style={{ imageRendering: "auto" }}
        />
      ) : null}
      <span
        className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-fg-muted)]"
        title={isAdmin ? "admin" : "read-only — your Discord ID is not on the admin list"}
      >
        {name}
      </span>
      {isAdmin && (
        <span
          className="border border-[var(--color-lime)]/40 bg-[var(--color-lime)]/10 px-1.5 py-px font-mono text-[9px] uppercase tracking-[0.18em] text-[var(--color-lime)]"
          title="admin"
        >
          admin
        </span>
      )}
      <button
        type="submit"
        title="sign out"
        className="text-[var(--color-fg-dim)] transition hover:text-[var(--color-fg)]"
      >
        <LogOut className="h-3 w-3" />
      </button>
      <Link href="/" className="hidden">home</Link>
    </form>
  );
}
