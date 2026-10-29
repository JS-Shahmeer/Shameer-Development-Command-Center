import type { Role } from "@prisma/client";
import { db } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { AppError, conflict, forbidden, notFound } from "@/lib/errors";
import { can, type Actor } from "@/lib/permissions";
import { displayName } from "@/lib/utils";

export const INVITE_TTL_DAYS = 14;

const requireAdmin = (actor: Actor) => {
  if (!can.manageUsers(actor)) throw forbidden("Only admins can manage users.");
};

export async function listUsers(actor: Actor) {
  requireAdmin(actor);
  return db.user.findMany({
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      role: true,
      title: true,
      isActive: true,
      createdAt: true,
      _count: { select: { memberships: true } },
    },
  });
}

/** Active users that can be added to projects; available to anyone who can create projects. */
export async function listAssignableUsers(actor: Actor) {
  if (!can.createProject(actor)) throw forbidden();
  return db.user.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true, role: true },
  });
}

export async function listInvites(actor: Actor) {
  requireAdmin(actor);
  return db.invite.findMany({
    where: { acceptedAt: null },
    orderBy: { createdAt: "desc" },
    include: { invitedBy: { select: { name: true, email: true } } },
  });
}

export async function createInvite(actor: Actor, input: { email: string; role: Role }) {
  requireAdmin(actor);
  if (await db.user.findUnique({ where: { email: input.email }, select: { id: true } })) {
    throw conflict("That person already has an account.");
  }
  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);
  return db.$transaction(async (tx) => {
    // Re-inviting an email refreshes its role and expiry.
    const invite = await tx.invite.upsert({
      where: { email: input.email },
      create: { ...input, expiresAt, invitedById: actor.id },
      update: { role: input.role, expiresAt, acceptedAt: null, invitedById: actor.id },
    });
    await logActivity(tx, {
      actorId: actor.id,
      action: "invite.created",
      entityType: "Invite",
      entityId: invite.id,
      summary: `invited ${invite.email}`,
    });
    return invite;
  });
}

export async function revokeInvite(actor: Actor, inviteId: string) {
  requireAdmin(actor);
  const invite = await db.invite.findUnique({ where: { id: inviteId } });
  if (!invite) throw notFound("Invite");
  await db.invite.delete({ where: { id: inviteId } });
  return invite;
}

async function assertAnotherAdminRemains(userId: string) {
  const admins = await db.user.count({ where: { role: "ADMIN", isActive: true, id: { not: userId } } });
  if (admins === 0) throw new AppError("The workspace needs at least one active admin.", "VALIDATION");
}

export async function changeUserRole(actor: Actor, userId: string, role: Role) {
  requireAdmin(actor);
  if (userId === actor.id) throw new AppError("You can't change your own role.", "VALIDATION");
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) throw notFound("User");
  if (user.role === "ADMIN" && role !== "ADMIN") await assertAnotherAdminRemains(userId);

  return db.$transaction(async (tx) => {
    const updated = await tx.user.update({ where: { id: userId }, data: { role } });
    // A developer can't lead projects, so demote their lead memberships.
    if (role === "DEVELOPER") {
      await tx.projectMember.updateMany({ where: { userId, role: "LEAD" }, data: { role: "MEMBER" } });
      await tx.project.updateMany({ where: { leadId: userId }, data: { leadId: null } });
    }
    await logActivity(tx, {
      actorId: actor.id,
      action: "user.role_changed",
      entityType: "User",
      entityId: userId,
      summary: `changed ${displayName(user)}'s role to ${role.toLowerCase()}`,
      metadata: { from: user.role, to: role },
    });
    return updated;
  });
}

export async function setUserActive(actor: Actor, userId: string, active: boolean) {
  requireAdmin(actor);
  if (userId === actor.id) throw new AppError("You can't deactivate yourself.", "VALIDATION");
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) throw notFound("User");
  if (!active && user.role === "ADMIN") await assertAnotherAdminRemains(userId);

  return db.$transaction(async (tx) => {
    const updated = await tx.user.update({ where: { id: userId }, data: { isActive: active } });
    await logActivity(tx, {
      actorId: actor.id,
      action: active ? "user.reactivated" : "user.deactivated",
      entityType: "User",
      entityId: userId,
      summary: `${active ? "reactivated" : "deactivated"} ${displayName(user)}`,
    });
    return updated;
  });
}
