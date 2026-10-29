import NextAuth, { type DefaultSession } from "next-auth";
import GitHub from "next-auth/providers/github";
import Credentials from "next-auth/providers/credentials";
import type { Provider } from "next-auth/providers";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { db } from "@/lib/db";
import { env, isDevLoginEnabled, isGithubAuthConfigured } from "@/lib/env";
import { canSignIn, onUserCreated } from "@/features/auth/service";

declare module "next-auth" {
  interface Session {
    user: { id: string } & DefaultSession["user"];
  }
}

const providers: Provider[] = [];

if (isGithubAuthConfigured) {
  providers.push(
    GitHub({
      clientId: env.AUTH_GITHUB_ID,
      clientSecret: env.AUTH_GITHUB_SECRET,
      profile(profile) {
        return {
          id: String(profile.id),
          name: profile.name ?? profile.login,
          email: profile.email?.toLowerCase() ?? null,
          image: profile.avatar_url,
        };
      },
    }),
  );
}

if (isDevLoginEnabled) {
  providers.push(
    Credentials({
      id: "dev-login",
      name: "Development login",
      credentials: { email: { label: "Email", type: "email" } },
      async authorize(credentials) {
        if (!isDevLoginEnabled) return null;
        const email = String(credentials?.email ?? "").toLowerCase();
        const user = await db.user.findUnique({ where: { email } });
        if (!user || !user.isActive) return null;
        return { id: user.id, name: user.name, email: user.email, image: user.image };
      },
    }),
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  // JWT sessions keep sign-in cheap; getCurrentUser() still reloads the user from
  // the database on every request, so role changes and deactivation apply at once.
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 7 },
  pages: { signIn: "/sign-in", error: "/sign-in" },
  providers,
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "dev-login") return true;
      const result = await canSignIn(user.email);
      return result.ok ? true : `/sign-in?error=${result.reason}`;
    },
    jwt({ token, user }) {
      if (user?.id) token.uid = user.id;
      return token;
    },
    session({ session, token }) {
      if (typeof token.uid === "string") session.user.id = token.uid;
      return session;
    },
  },
  events: {
    async createUser({ user }) {
      if (user.id && user.email) await onUserCreated(user.id, user.email);
    },
  },
});
