import { addDays, startOfDay } from "date-fns";
import { db } from "@/lib/db";
import { isAdmin, visibleProjectsWhere, visibleTasksWhere, type Actor } from "@/lib/permissions";

export async function getDashboard(actor: Actor) {
  const visible = { AND: [visibleProjectsWhere(actor), { archivedAt: null }] };
  const today = startOfDay(new Date());
  const open = { status: { not: "COMPLETED" as const } };

  const tasks = visibleTasksWhere(actor);
  const openTask = { status: { not: "DONE" as const } };
  const taskInclude = {
    project: { select: { name: true, slug: true } },
    assignee: { select: { id: true, name: true, email: true, image: true } },
  };

  const [blocked, overdueTasks, myTasks, myOpenCount] = await Promise.all([
    db.task.findMany({
      where: { AND: [tasks, { status: "BLOCKED" }] },
      orderBy: { updatedAt: "desc" },
      take: 8,
      include: taskInclude,
    }),
    db.task.findMany({
      where: { AND: [tasks, openTask, { dueDate: { lt: today } }] },
      orderBy: { dueDate: "asc" },
      take: 8,
      include: taskInclude,
    }),
    db.task.findMany({
      where: { AND: [tasks, openTask, { assigneeId: actor.id }] },
      orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { priority: "desc" }],
      take: 8,
      include: taskInclude,
    }),
    db.task.count({ where: { AND: [tasks, openTask, { assigneeId: actor.id }] } }),
  ]);
  const [blockedCount, overdueTaskCount] = await Promise.all([
    db.task.count({ where: { AND: [tasks, { status: "BLOCKED" }] } }),
    db.task.count({ where: { AND: [tasks, openTask, { dueDate: { lt: today } }] } }),
  ]);

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
    tasks: {
      blocked,
      overdue: overdueTasks,
      mine: myTasks,
      counts: { mine: myOpenCount, blocked: blockedCount, overdue: overdueTaskCount },
    },
  };
}
