import NextAuth, { type Session } from "next-auth";
import Discord from "next-auth/providers/discord";
import { cookies } from "next/headers";

const DEV_COOKIE = "cl_dev_session";
type DevRole = "admin" | "user";

/**
 * Comma-separated Discord user IDs (snowflakes) who are admins.
 * Parsed once per request inside the JWT callback so a deploy with an updated
 * allowlist takes effect on next sign-in / token refresh.
 */
function parseAdminIds(): string[] {
  return (process.env.ADMIN_DISCORD_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Discord],
  session: { strategy: "jwt" },
  trustHost: true,
  callbacks: {
    async jwt({ token, profile }) {
      // First sign-in: profile is populated with Discord fields
      if (profile?.id) {
        const id = String(profile.id);
        token.discordId = id;
        token.isAdmin = parseAdminIds().includes(id);
      } else if (token.discordId) {
        // Subsequent requests: re-evaluate admin status from the env each time
        // so admin grants/revokes in env take effect at next token use.
        token.isAdmin = parseAdminIds().includes(String(token.discordId));
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.isAdmin = Boolean(token.isAdmin);
        session.user.discordId = (token.discordId as string | undefined) ?? null;
      }
      return session;
    },
  },
});

/**
 * Returns the current session.
 *
 * When NEXTAUTH_DEV_BYPASS=1, real Discord OAuth is bypassed in favor of a
 * cookie-driven fake session: the dev operator can toggle between admin /
 * non-admin / signed-out via the AuthControl in the header. Default state is
 * *signed out* — exercise the sign-in flow explicitly.
 *
 * Never enable NEXTAUTH_DEV_BYPASS in production env.
 */
export async function getAuthSession(): Promise<Session | null> {
  if (process.env.NEXTAUTH_DEV_BYPASS === "1") {
    const c = await cookies();
    const role = c.get(DEV_COOKIE)?.value as DevRole | undefined;
    if (!role) return null;
    return {
      user: {
        name: role === "admin" ? "Dev Admin" : "Dev User",
        email: role === "admin" ? "admin@dev" : "user@dev",
        image: null,
        isAdmin: role === "admin",
        discordId: `dev-${role}`,
      },
      expires: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    } as unknown as Session;
  }
  return auth();
}

/** Dev-only: stamp a cookie that getAuthSession() reads back as the chosen role. */
export async function devSignIn(role: DevRole): Promise<void> {
  if (process.env.NEXTAUTH_DEV_BYPASS !== "1") return;
  const c = await cookies();
  c.set(DEV_COOKIE, role, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24, // 24h
  });
}

/** Dev-only: clear the fake session cookie. */
export async function devSignOut(): Promise<void> {
  if (process.env.NEXTAUTH_DEV_BYPASS !== "1") return;
  const c = await cookies();
  c.delete(DEV_COOKIE);
}

/** Throws if the current session is not an admin. Use at the top of mutation server actions. */
export async function requireAdmin(): Promise<Session> {
  const session = await getAuthSession();
  if (!session?.user?.isAdmin) {
    throw new Error("forbidden: admin sign-in required");
  }
  return session;
}
