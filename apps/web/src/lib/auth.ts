import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db, users } from "@ai-interviewer/db";
import { eq } from "drizzle-orm";
import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";

import { verifyPassword } from "@/lib/password";

// Surfaced verbatim to the client via signIn()'s result.error (see the
// CredentialsSignin doc comment on `code`) — the sign-in page uses this
// exact string to route an unverified user into the verification step
// instead of showing a generic "invalid credentials" message.
class EmailNotVerifiedError extends CredentialsSignin {
  code = "email_not_verified";
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db),
  session: { strategy: "jwt" },
  providers: [
    // Google/GitHub removed for now — not configured/available yet. Re-add
    // as provider entries here when that's ready; nothing else in this file
    // depends on them.
    Credentials({
      id: "password",
      name: "Email and password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;
        if (!email || !password) return null;

        const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
        if (!user || !user.passwordHash) return null;

        const valid = await verifyPassword(password, user.passwordHash);
        if (!valid) return null;

        // Gate here, not in middleware: refusing to issue a session at all
        // is what actually keeps an unverified account out of the app —
        // there's no session to carry into /dashboard either way.
        if (!user.emailVerified) throw new EmailNotVerifiedError();

        return user;
      },
    }),
  ],
  pages: {
    signIn: "/sign-in",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.id = user.id;
      return token;
    },
    async session({ session, token }) {
      if (session.user) session.user.id = token.id as string;
      return session;
    },
  },
});
