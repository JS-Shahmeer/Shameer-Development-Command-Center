import { startOfDay, subDays } from "date-fns";
import { db } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { forbidden, notFound } from "@/lib/errors";
import { can, visibleTasksWhere, visibleTeamWhere, type Actor } from "@/lib/permissions";
import type { ProfileInput } from "./schemas";

export type Workload = {
  openTasks: number;
  openHours: number;
  unestimated: number;
  overdue: number;
  blocked: number;
  capacityHours: number;
  /** Open estimated hours as a share of one week's capacity. */
  load: number;
};

/** Workload per user from their open (not done) assigned tasks in active projects. */
export async function workloadFor(
  userIds: string[],
): Promise<Map<string, Omit<Workload, "capacityHours" | "load">>> {
  const today = startOfDay(new Date());
  const tasks = await db.task.findMany({
    where: { assigneeId: { in: userIds }, status: { not: "DONE" }, project: { archivedAt: null } },
    select: { assigneeId: true, estimateHours: true, dueDate: true, status: true },
  });
  const map = new Map(
    userIds.map((id) => [id, { openTasks: 0, openHours: 0, unestimated: 0, overdue: 0, blocked: 0 }]),
  );
  for (const t of tasks) {
    const w = map.get(t.assigneeId!);
    if (!w) continue;
    w.openTasks++;
    if (t.estimateHours == null) w.unestimated++;
    else w.openHours += t.estimateHours;
    if (t.dueDate && t.dueDate < today) w.overdue++;
    if (t.status === "BLOCKED") w.blocked++;
  }
  return map;
}

const withLoad = (w: Omit<Workload, "capacityHours" | "load">, capacityHours: number): Workload => ({
  ...w,
  capacityHours,
  load: capacityHours > 0 ? w.openHours / capacityHours : w.openHours > 0 ? Infinity : 0,
});

export async function listTeam(actor: Actor) {
  if (!can.viewTeam(actor)) throw forbidden("Only admins and project leads can see the whole team.");
  const users = await db.user.findMany({
    where: { AND: [visibleTeamWhere(actor), { isActive: true }] },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      role: true,
      title: true,
      capacityHours: true,
      skills: { select: { level: true, skill: { select: { name: true } } }, orderBy: { level: "desc" } },
      _count: { select: { memberships: { where: { project: { archivedAt: null } } } } },
    },
  });
  const workloads = await workloadFor(users.map((u) => u.id));
  return users.map((u) => ({ ...u, workload: withLoad(workloads.get(u.id)!, u.capacityHours) }));
}

export async function getMember(actor: Actor, userId: string) {
  const user = await db.user.findFirst({
    where: { AND: [{ id: userId }, visibleTeamWhere(actor)] },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      role: true,
      title: true,
      bio: true,
      capacityHours: true,
      isActive: true,
      skills: {
        select: { level: true, skill: { select: { id: true, name: true } } },
        orderBy: { level: "desc" },
      },
      memberships: {
        where: { project: { archivedAt: null } },
        select: { role: true, project: { select: { id: true, name: true, slug: true, status: true } } },
      },
    },
  });
  if (!user) throw notFound("Person");

  const [workloads, openTasks, recentlyDone] = await Promise.all([
    workloadFor([user.id]),
    db.task.findMany({
      where: { AND: [visibleTasksWhere(actor), { assigneeId: user.id, status: { not: "DONE" } }] },
      orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { priority: "desc" }],
      include: { project: { select: { name: true, slug: true } } },
    }),
    db.task.findMany({
      where: {
        AND: [
          visibleTasksWhere(actor),
          { assigneeId: user.id, status: "DONE", completedAt: { gte: subDays(new Date(), 14) } },
        ],
      },
      orderBy: { completedAt: "desc" },
      take: 10,
      include: { project: { select: { name: true, slug: true } } },
    }),
  ]);

  return {
    user,
    workload: withLoad(workloads.get(user.id)!, user.capacityHours),
    openTasks,
    recentlyDone,
    permissions: { edit: can.editProfile(actor, user.id), setCapacity: can.setCapacity(actor) },
  };
}

export async function updateProfile(actor: Actor, input: ProfileInput) {
  if (!can.editProfile(actor, input.userId)) throw forbidden("You can only edit your own profile.");
  if (input.capacityHours !== undefined && !can.setCapacity(actor)) {
    throw forbidden("Only admins can change weekly capacity.");
  }
  const exists = await db.user.findUnique({ where: { id: input.userId }, select: { id: true } });
  if (!exists) throw notFound("Person");

  return db.$transaction(async (tx) => {
    const skillIds: { skillId: string; level: number }[] = [];
    for (const s of input.skills) {
      // Reuse an existing skill regardless of case so "react" and "React" don't split.
      const existing = await tx.skill.findFirst({ where: { name: { equals: s.name, mode: "insensitive" } } });
      const skill = existing ?? (await tx.skill.create({ data: { name: s.name } }));
      skillIds.push({ skillId: skill.id, level: s.level });
    }

    await tx.userSkill.deleteMany({ where: { userId: input.userId } });
    if (skillIds.length) {
      await tx.userSkill.createMany({ data: skillIds.map((s) => ({ ...s, userId: input.userId })) });
    }

    const user = await tx.user.update({
      where: { id: input.userId },
      data: {
        name: input.name,
        title: input.title,
        bio: input.bio,
        ...(input.capacityHours !== undefined ? { capacityHours: input.capacityHours } : {}),
      },
    });
    await logActivity(tx, {
      actorId: actor.id,
      action: "user.profile_updated",
      entityType: "User",
      entityId: user.id,
      summary:
        actor.id === user.id ? "updated their profile" : `updated ${user.name ?? user.email}'s profile`,
    });
    return user;
  });
}

/** Skill names already in use, for autocomplete. */
export function listSkillNames() {
  return db.skill.findMany({ orderBy: { name: "asc" }, select: { name: true } });
}
