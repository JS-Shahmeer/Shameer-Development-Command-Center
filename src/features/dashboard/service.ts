import { addDays, startOfDay } from "date-fns";
import { db } from "@/lib/db";
import { isAdmin, visibleProjectsWhere, type Actor } from "@/lib/permissions";

export async function getDashboard(actor: Actor) {
  const visible = { AND: [visibleProjectsWhere(actor), { archivedAt: null }] };
  const today = startOfDay(new Date());
  const open = { status: { not: "COMPLETED" as const } };

  const [byStatus, overdue, upcoming, visibleIds] = await Promise.all([
    db.project.groupBy({ by: ["status"], where: visible, _count: { _all: true } }),
    db.project.findMany({
      where: { AND: [visible, open, { dueDate: { lt: today } }] },
      orderBy: { dueDate: "asc" },
      take: 8,
      include: { client: { select: { name: true } } },
    }),
    db.project.findMany({
      where: { AND: [visible, open, { dueDate: { gte: today, lte: addDays(today, 21) } }] },
      orderBy: { dueDate: "asc" },
      take: 8,
      include: { client: { select: { name: true } } },
    }),
    isAdmin(actor)
      ? Promise.resolve(null)
      : db.project.findMany({ where: visibleProjectsWhere(actor), select: { id: true } }),
  ]);

  const activity = await db.activityLog.findMany({
    where: visibleIds
      ? { OR: [{ projectId: { in: visibleIds.map((p) => p.id) } }, { actorId: actor.id }] }
      : undefined,
    orderBy: { createdAt: "desc" },
    take: 15,
    include: { actor: { select: { id: true, name: true, email: true, image: true } } },
  });

  const counts = Object.fromEntries(byStatus.map((s) => [s.status, s._count._all])) as Record<
    string,
    number | undefined
  >;

  return {
    counts: {
      active: counts.ACTIVE ?? 0,
      planning: counts.PLANNING ?? 0,
      onHold: counts.ON_HOLD ?? 0,
      completed: counts.COMPLETED ?? 0,
    },
    overdue,
    upcoming,
    activity,
  };
}
