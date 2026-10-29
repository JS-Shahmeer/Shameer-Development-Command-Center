import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { notFound } from "@/lib/errors";
import { can, visibleProjectsWhere, visibleTasksWhere, type Actor } from "@/lib/permissions";
import { displayName } from "@/lib/utils";

export type ReportPeriod = "daily" | "weekly";

const DAY = 24 * 60 * 60 * 1000;

/** Parses YYYY-MM-DD as a UTC day; falls back to today (UTC). */
export function parseDay(value: string | undefined) {
  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const d = match ? new Date(Date.UTC(+match[1]!, +match[2]! - 1, +match[3]!)) : new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export const toDayString = (d: Date) => d.toISOString().slice(0, 10);

/** Report window in UTC: one day, or Monday to Sunday for weekly. */
export function reportRange(period: ReportPeriod, day: Date) {
  if (period === "daily") return { start: day, end: new Date(day.getTime() + DAY) };
  const offset = (day.getUTCDay() + 6) % 7; // days since Monday
  const start = new Date(day.getTime() - offset * DAY);
  return { start, end: new Date(start.getTime() + 7 * DAY) };
}

export async function getReport(
  actor: Actor,
  input: { period: ReportPeriod; day: Date; projectId?: string; now?: Date },
) {
  const { start, end } = reportRange(input.period, input.day);
  const now = input.now ?? new Date();

  if (input.projectId) {
    const project = await db.project.findUnique({
      where: { id: input.projectId },
      select: { leadId: true, members: { select: { userId: true, role: true } } },
    });
    if (!project || !can.viewProject(actor, project)) throw notFound("Project");
  }

  const tasks: Prisma.TaskWhereInput = {
    AND: [visibleTasksWhere(actor), input.projectId ? { projectId: input.projectId } : {}],
  };
  const open: Prisma.TaskWhereInput = { status: { not: "DONE" } };
  const taskSelect = {
    id: true,
    title: true,
    status: true,
    priority: true,
    dueDate: true,
    estimateHours: true,
    completedAt: true,
    blockedReason: true,
    project: { select: { id: true, name: true, slug: true } },
    assignee: { select: { id: true, name: true, email: true } },
  } satisfies Prisma.TaskSelect;

  const projectScope: Prisma.ProjectWhereInput = {
    AND: [visibleProjectsWhere(actor), { archivedAt: null }, input.projectId ? { id: input.projectId } : {}],
  };

  const [completed, createdCount, started, blocked, overdue, dueNext, projects, activity] = await Promise.all(
    [
      db.task.findMany({
        where: { AND: [tasks, { status: "DONE", completedAt: { gte: start, lt: end } }] },
        orderBy: { completedAt: "asc" },
        select: taskSelect,
      }),
      db.task.count({ where: { AND: [tasks, { createdAt: { gte: start, lt: end } }] } }),
      db.activityLog.count({
        where: {
          action: "task.status_changed",
          createdAt: { gte: start, lt: end },
          metadata: { path: ["to"], equals: "IN_PROGRESS" },
          projectId: input.projectId ? input.projectId : { in: await visibleProjectIds(actor) },
        },
      }),
      db.task.findMany({
        where: { AND: [tasks, { status: "BLOCKED" }] },
        orderBy: { updatedAt: "asc" },
        select: taskSelect,
      }),
      db.task.findMany({
        where: { AND: [tasks, open, { dueDate: { lt: now } }] },
        orderBy: { dueDate: "asc" },
        select: taskSelect,
      }),
      db.task.findMany({
        where: {
          AND: [
            tasks,
            open,
            { dueDate: { gte: now, lt: new Date(now.getTime() + (end.getTime() - start.getTime())) } },
          ],
        },
        orderBy: { dueDate: "asc" },
        select: taskSelect,
      }),
      db.project.findMany({
        where: projectScope,
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          slug: true,
          status: true,
          dueDate: true,
          tasks: { select: { status: true, completedAt: true } },
        },
      }),
      db.activityLog.findMany({
        where: {
          createdAt: { gte: start, lt: end },
          projectId: input.projectId ? input.projectId : { in: await visibleProjectIds(actor) },
        },
        orderBy: { createdAt: "desc" },
        take: 50,
        include: { actor: { select: { id: true, name: true, email: true, image: true } } },
      }),
    ],
  );

  const people = new Map<string, { id: string; name: string; tasks: number; hours: number }>();
  for (const t of completed) {
    if (!t.assignee) continue;
    const row = people.get(t.assignee.id) ?? {
      id: t.assignee.id,
      name: displayName(t.assignee),
      tasks: 0,
      hours: 0,
    };
    row.tasks++;
    row.hours += t.estimateHours ?? 0;
    people.set(t.assignee.id, row);
  }

  const projectRows = projects
    .map((p) => {
      const total = p.tasks.length;
      const done = p.tasks.filter((t) => t.status === "DONE").length;
      return {
        id: p.id,
        name: p.name,
        slug: p.slug,
        status: p.status,
        dueDate: p.dueDate,
        total,
        done,
        blocked: p.tasks.filter((t) => t.status === "BLOCKED").length,
        completedInPeriod: p.tasks.filter(
          (t) => t.completedAt && t.completedAt >= start && t.completedAt < end,
        ).length,
        progress: total ? done / total : 0,
      };
    })
    .filter((p) => p.total > 0 || input.projectId);

  return {
    period: input.period,
    start,
    end,
    summary: {
      completed: completed.length,
      completedHours: completed.reduce((n, t) => n + (t.estimateHours ?? 0), 0),
      created: createdCount,
      started,
      blocked: blocked.length,
      overdue: overdue.length,
    },
    completed,
    blocked,
    overdue,
    dueNext,
    people: [...people.values()].sort((a, b) => b.tasks - a.tasks),
    projects: projectRows,
    activity,
  };
}

async function visibleProjectIds(actor: Actor) {
  return (await db.project.findMany({ where: visibleProjectsWhere(actor), select: { id: true } })).map(
    (p) => p.id,
  );
}

export type Report = Awaited<ReturnType<typeof getReport>>;

const fmt = (d: Date) => d.toISOString().slice(0, 10);

/** Plain Markdown for pasting into Slack, email or a client update. */
export function reportToMarkdown(r: Report, scopeLabel: string) {
  const last = new Date(r.end.getTime() - DAY);
  const title =
    r.period === "daily" ? `Daily report, ${fmt(r.start)}` : `Weekly report, ${fmt(r.start)} to ${fmt(last)}`;
  const lines = [
    `# ${title}`,
    `_${scopeLabel}_`,
    "",
    `**${r.summary.completed}** tasks done (${r.summary.completedHours}h estimated), **${r.summary.created}** created, **${r.summary.blocked}** blocked, **${r.summary.overdue}** overdue.`,
    "",
    "## Done",
    ...(r.completed.length
      ? r.completed.map(
          (t) => `- ${t.title} (${t.project.name}${t.assignee ? `, ${displayName(t.assignee)}` : ""})`,
        )
      : ["- Nothing completed."]),
    "",
    "## Blocked",
    ...(r.blocked.length
      ? r.blocked.map((t) => `- ${t.title} (${t.project.name}): ${t.blockedReason ?? "no reason given"}`)
      : ["- Nothing blocked."]),
    "",
    "## Overdue",
    ...(r.overdue.length
      ? r.overdue.map((t) => `- ${t.title} (${t.project.name}), due ${t.dueDate ? fmt(t.dueDate) : "?"}`)
      : ["- Nothing overdue."]),
    "",
    `## Coming up`,
    ...(r.dueNext.length
      ? r.dueNext.map((t) => `- ${t.title} (${t.project.name}), due ${t.dueDate ? fmt(t.dueDate) : "?"}`)
      : ["- Nothing due."]),
  ];
  if (r.projects.length) {
    lines.push(
      "",
      "## Projects",
      ...r.projects.map(
        (p) => `- ${p.name}: ${p.done}/${p.total} tasks done${p.blocked ? `, ${p.blocked} blocked` : ""}`,
      ),
    );
  }
  return lines.join("\n");
}
