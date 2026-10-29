import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Terminal } from "lucide-react";
import { GithubIcon } from "@/components/shared/github-icon";
import { db } from "@/lib/db";
import { isDevLoginEnabled, isGithubAuthConfigured } from "@/lib/env";
import { getCurrentUser } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { signInAsDevUser, signInWithGithub } from "@/features/auth/actions";
import { roleLabel } from "@/features/users/schemas";

export const metadata: Metadata = { title: "Sign in" };

const ERRORS: Record<string, string> = {
  NotInvited: "This account hasn't been invited. Ask an admin to invite your email address.",
  Deactivated: "Your account has been deactivated. Contact an admin if this is a mistake.",
  NoEmail:
    "We couldn't read an email address from GitHub. Make sure your GitHub account has a verified email.",
  OAuthAccountNotLinked: "That email is already linked to a different sign-in method.",
  AccessDenied: "Access denied. Ask an admin to invite you.",
  CredentialsSignin: "That development user doesn't exist or is inactive.",
};

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await getCurrentUser()) redirect("/dashboard");
  const { error } = await searchParams;
  const message = error ? (ERRORS[error] ?? "Sign-in failed. Please try again.") : null;

  const devUsers = isDevLoginEnabled
    ? await db.user.findMany({
        where: { isActive: true },
        orderBy: [{ role: "asc" }, { name: "asc" }],
        select: { email: true, name: true, role: true },
      })
    : [];

  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <div className="bg-surface w-full max-w-sm rounded-xl border p-6 shadow-sm">
        <div className="mb-6 flex items-center gap-2">
          <span className="bg-primary text-primary-foreground rounded-md p-1.5">
            <Terminal className="size-4" aria-hidden />
          </span>
          <div>
            <h1 className="font-semibold">Developer Command Center</h1>
            <p className="text-muted text-xs">Invite-only workspace</p>
          </div>
        </div>

        {message && (
          <p
            role="alert"
            className="border-danger/30 bg-danger/10 text-danger mb-4 rounded-md border px-3 py-2 text-sm"
          >
            {message}
          </p>
        )}

        {isGithubAuthConfigured ? (
          <form action={signInWithGithub}>
            <Button type="submit" className="w-full">
              <GithubIcon className="size-4" /> Continue with GitHub
            </Button>
          </form>
        ) : (
          <p className="bg-surface-muted text-muted rounded-md border px-3 py-2 text-sm">
            GitHub sign-in isn&apos;t configured. Set <code className="font-mono">AUTH_GITHUB_ID</code> and{" "}
            <code className="font-mono">AUTH_GITHUB_SECRET</code>.
          </p>
        )}

        {isDevLoginEnabled && (
          <form action={signInAsDevUser} className="mt-6 space-y-2 border-t pt-4">
            <label htmlFor="dev-email" className="text-muted text-xs font-medium">
              Development only: sign in as a seeded user
            </label>
            {devUsers.length ? (
              <>
                <Select id="dev-email" name="email" required defaultValue={devUsers[0]?.email}>
                  {devUsers.map((u) => (
                    <option key={u.email} value={u.email}>
                      {u.name ?? u.email} ({roleLabel[u.role]})
                    </option>
                  ))}
                </Select>
                <Button type="submit" variant="secondary" className="w-full">
                  Sign in as this user
                </Button>
              </>
            ) : (
              <p className="text-muted text-sm">
                No users yet. Run <code className="font-mono">pnpm db:seed</code>.
              </p>
            )}
          </form>
        )}
      </div>
    </main>
  );
}
