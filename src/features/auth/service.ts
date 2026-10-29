import { db } from "@/lib/db";
import { logActivity } from "@/lib/activity";

export type SignInDenial = "NoEmail" | "NotInvited" | "Deactivated";

const adminEmail = () => process.env.ADMIN_EMAIL?.toLowerCase();

/** Invite-only sign-in: existing active users, the bootstrap admin, or a valid invite. */
export async function canSignIn(
  rawEmail: string | null | undefined,
): Promise<{ ok: true } | { ok: false; reason: SignInDenial }> {
  const email = rawEmail?.toLowerCase();
  if (!email) return { ok: false, reason: "NoEmail" };

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) return existing.isActive ? { ok: true } : { ok: false, reason: "Deactivated" };

  if (email === adminEmail()) return { ok: true };

  const invite = await db.invite.findUnique({ where: { email } });
  if (invite && !invite.acceptedAt && invite.expiresAt > new Date()) return { ok: true };

  return { ok: false, reason: "NotInvited" };
}

/** Applies the invited role (or ADMIN for the bootstrap email) to a brand-new user. */
export async function onUserCreated(userId: string, rawEmail: string) {
  const email = rawEmail.toLowerCase();

  if (email === adminEmail()) {
    await db.user.update({ where: { id: userId }, data: { role: "ADMIN", email } });
  } else {
    const invite = await db.invite.findUnique({ where: { email } });
    if (invite) {
      await db.$transaction([
        db.user.update({ where: { id: userId }, data: { role: invite.role, email } }),
        db.invite.update({ where: { id: invite.id }, data: { acceptedAt: new Date() } }),
      ]);
    }
  }

  await logActivity(db, {
    actorId: userId,
    action: "user.joined",
    entityType: "User",
    entityId: userId,
    summary: "joined the workspace",
  });
}
