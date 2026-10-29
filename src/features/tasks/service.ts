import type { Prisma, TaskStatus } from "@prisma/client";
import type { z } from "zod";
import { db } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { AppError, forbidden, notFound } from "@/lib/errors";
import { can, isProjectMember, visibleTasksWhere, type Actor } from "@/lib/permissions";
import { requireProjectView } from "@/features/projects/service";
import { displayName } from "@/lib/utils";
import { taskListFilter, taskStatusLabel, type TaskInput } from "./schemas";

const PRIORITY_ORDER = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 } as const;

/** Loads a task with its project's access info; hides it unless the actor can see the project. */
async function loadTask(actor: Actor, taskId: string) {
  const task = await db.task.findUnique({
    where: { id: taskId },
    select: { id: true, title: true, projectId: true, status: true, assigneeId: true, reporterId: true },
  });
  if (!task) throw notFound("Task");
  try {
    const project = await requireProjectView(actor, task.projectId);
    return { task, project };
  } catch {
    throw notFound("Task");
  }
}

async function assertAssignable(
  project: Awaited<ReturnType<typeof requireProjectView>>,
  assigneeId: string | null,
) {
  if (!assigneeId) return;
  const user = await db.user.findUnique({
    where: { id: assigneeId },
    select: { id: true, role: true, isActive: true },
  });
  if (!user || !user.isActive || !isProjectMember(user, project)) {
    throw new AppError("Assign the task to someone on this project.", "VALIDATION");
  }
}

/** True when adding "taskId depends on dependsOnId" would create a loop. */
export async function wouldCreateCycle(taskId: string, dependsOnId: string) {
  if (taskId === dependsOnId) return true;
  const seen = new Set<string>();
  let frontier = [dependsOnId];
  while (frontier.length) {
    const edges = await db.taskDependency.findMany({
      where: { taskId: { in: frontier } },
      select: { dependsOnId: true },
    });
    frontier = [];
    for (const { dependsOnId: next } of edges) {
      if (next === taskId) return true;
      if (!seen.has(next)) {
        seen.add(next);
        frontier.push(next);
      }
    }
  }
  return false;
}

async function openDependencies(taskId: string) {
  return db.taskDependency.findMany({
    where: { taskId, dependsOn: { status: { not: "DONE" } } },
    select: { dependsOn: { select: { id: true, title: true } } },
  });
}

async function nextPosition(projectId: string, status: TaskStatus) {
  const last = await db.task.findFirst({
    where: { projectId, status },
    orderBy: { position: "desc" },
    select: { position: true },
  });
  return (last?.position ?? 0) + 1;
}

const listInclude = {
  project: { select: { id: true, name: true, slug: true } },
  assignee: { select: { id: true, name: true, email: true, image: true } },
  _count: { select: { criteria: true, comments: true, dependsOn: true } },
  criteria: { select: { done: true } },
  dependsOn: { select: { dependsOn: { select: { status: true } } } },
} satisfies Prisma.TaskInclude;

export type TaskListItem = Prisma.TaskGetPayload<{ include: typeof listInclude }>;

function sortTasks<
  T extends { priority: keyof typeof PRIORITY_ORDER; dueDate: Date | null; position: number },
>(tasks: T[]) {
  return tasks.sort(
    (a, b) =>
      PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] ||
      (a.dueDate?.getTime() ?? Infinity) - (b.dueDate?.getTime() ?? Infinity) ||
      a.position - b.position,
  );
}

export async function listTasks(actor: Actor, rawFilter: z.input<typeof taskListFilter> = {}) {
  const f = taskListFilter.parse(rawFilter);
  const where: Prisma.TaskWhereInput = {
    AND: [
      visibleTasksWhere(actor),
      f.projectId ? { projectId: f.projectId } : {},
      f.status ? { status: f.status } : {},
      f.open ? { status: { not: "DONE" } } : {},
      f.priority ? { priority: f.priority } : {},
      f.assigneeId === "none" ? { assigneeId: null } : f.assigneeId ? { assigneeId: f.assigneeId } : {},
      f.q
        ? {
            OR: [
              { title: { contains: f.q, mode: "insensitive" } },
              { description: { contains: f.q, mode: "insensitive" } },
            ],
          }
        : {},
    ],
  };
  const tasks = await db.task.findMany({ where, include: listInclude, take: 500 });
  return sortTasks(tasks);
}

export async function listProjectTasks(actor: Actor, projectId: string) {
  await requireProjectView(actor, projectId);
  return db.task.findMany({
    where: { projectId },
    include: listInclude,
    orderBy: [{ status: "asc" }, { position: "asc" }],
  });
}

export async function getTask(actor: Actor, taskId: string) {
  const { project } = await loadTask(actor, taskId);
  const task = await db.task.findUniqueOrThrow({
    where: { id: taskId },
    include: {
      project: {
        select: {
          id: true,
          name: true,
          slug: true,
          leadId: true,
          members: {
            select: { userId: true, role: true, user: { select: { id: true, name: true, email: true } } },
          },
        },
      },
      assignee: { select: { id: true, name: true, email: true, image: true } },
      reporter: { select: { id: true, name: true, email: true, image: true } },
      criteria: { orderBy: [{ position: "asc" }, { createdAt: "asc" }] },
      comments: {
        orderBy: { createdAt: "asc" },
        include: { author: { select: { id: true, name: true, email: true, image: true } } },
      },
      dependsOn: { include: { dependsOn: { select: { id: true, title: true, status: true } } } },
      dependents: { include: { task: { select: { id: true, title: true, status: true } } } },
    },
  });

  // Candidate prerequisites: other tasks in the same project not already linked.
  const linked = new Set([task.id, ...task.dependsOn.map((d) => d.dependsOnId)]);
  const candidates = (
    await db.task.findMany({
      where: { projectId: task.projectId },
      select: { id: true, title: true, status: true },
      orderBy: { createdAt: "asc" },
    })
  ).filter((t) => !linked.has(t.id));

  return {
    task,
    candidates,
    permissions: {
      manage: can.manageTasks(actor, project),
      edit: can.editTask(actor, project, task),
      progress: can.updateTaskProgress(actor, project, task),
      comment: can.commentOnTask(actor, project),
    },
  };
}

export async function createTask(
  actor: Actor,
  input: { projectId: string; status: TaskStatus; data: TaskInput; criteria: string[] },
) {
  const project = await requireProjectView(actor, input.projectId);
  if (!can.createTask(actor, project)) throw forbidden();
  // Developers can raise tasks but not hand work to someone else.
  if (input.data.assigneeId && input.data.assigneeId !== actor.id && !can.manageTasks(actor, project)) {
    throw forbidden("Only the project lead can assign tasks to other people.");
  }
  if (input.status === "BLOCKED" || input.status === "DONE") {
    throw new AppError("New tasks start in Backlog, To do, In progress or In review.", "VALIDATION");
  }
  await assertAssignable(project, input.data.assigneeId);
  const position = await nextPosition(input.projectId, input.status);

  return db.$transaction(async (tx) => {
    const task = await tx.task.create({
      data: {
        ...input.data,
        projectId: input.projectId,
        status: input.status,
        reporterId: actor.id,
        position,
        criteria: { create: input.criteria.map((text, i) => ({ text, position: i })) },
      },
    });
    await logActivity(tx, {
      actorId: actor.id,
      action: "task.created",
      entityType: "Task",
      entityId: task.id,
      projectId: task.projectId,
      summary: `created task "${task.title}" in ${project.name}`,
    });
    return task;
  });
}

export async function updateTask(actor: Actor, taskId: string, input: TaskInput) {
  const { task, project } = await loadTask(actor, taskId);
  if (!can.editTask(actor, project, task)) throw forbidden("You can't edit this task.");
  if (input.assigneeId !== task.assigneeId && !can.manageTasks(actor, project)) {
    // A reporter may only take the task themselves or leave the assignee unchanged.
    if (input.assigneeId !== actor.id) throw forbidden("Only the project lead can reassign tasks.");
  }
  await assertAssignable(project, input.assigneeId);

  return db.$transaction(async (tx) => {
    const updated = await tx.task.update({ where: { id: taskId }, data: input });
    if (input.assigneeId !== task.assigneeId) {
      const assignee = input.assigneeId
        ? await tx.user.findUnique({ where: { id: input.assigneeId }, select: { name: true, email: true } })
        : null;
      await logActivity(tx, {
        actorId: actor.id,
        action: "task.assigned",
        entityType: "Task",
        entityId: taskId,
        projectId: task.projectId,
        summary: assignee
          ? `assigned "${updated.title}" to ${displayName(assignee)}`
          : `unassigned "${updated.title}"`,
      });
    } else {
      await logActivity(tx, {
        actorId: actor.id,
        action: "task.updated",
        entityType: "Task",
        entityId: taskId,
        projectId: task.projectId,
        summary: `updated task "${updated.title}"`,
      });
    }
    return updated;
  });
}

export async function setTaskStatus(
  actor: Actor,
  input: { id: string; status: TaskStatus; blockedReason: string | null },
) {
  const { task, project } = await loadTask(actor, input.id);
  if (!can.updateTaskProgress(actor, project, task)) {
    throw forbidden("Only the assignee or the project lead can change this task's status.");
  }
  if (input.status === task.status && input.status !== "BLOCKED") {
    return db.task.findUniqueOrThrow({ where: { id: task.id } });
  }

  if (input.status === "DONE") {
    const open = await openDependencies(task.id);
    if (open.length) {
      const names = open.map((d) => `"${d.dependsOn.title}"`).join(", ");
      throw new AppError(
        `Finish ${names} first. This task depends on ${open.length === 1 ? "it" : "them"}.`,
        "VALIDATION",
      );
    }
  }

  const position = await nextPosition(task.projectId, input.status);
  return db.$transaction(async (tx) => {
    const updated = await tx.task.update({
      where: { id: task.id },
      data: {
        status: input.status,
        position,
        blockedReason: input.status === "BLOCKED" ? input.blockedReason : null,
        completedAt: input.status === "DONE" ? new Date() : null,
      },
    });
    await logActivity(tx, {
      actorId: actor.id,
      action:
        input.status === "BLOCKED"
          ? "task.blocked"
          : input.status === "DONE"
            ? "task.completed"
            : "task.status_changed",
      entityType: "Task",
      entityId: task.id,
      projectId: task.projectId,
      summary:
        input.status === "BLOCKED"
          ? `marked "${task.title}" blocked: ${input.blockedReason}`
          : `moved "${task.title}" to ${taskStatusLabel[input.status]}`,
      metadata: { from: task.status, to: input.status },
    });
    return updated;
  });
}

export async function deleteTask(actor: Actor, taskId: string) {
  const { task, project } = await loadTask(actor, taskId);
  if (!can.manageTasks(actor, project)) throw forbidden("Only the project lead can delete tasks.");
  await db.$transaction(async (tx) => {
    await tx.task.delete({ where: { id: taskId } });
    await logActivity(tx, {
      actorId: actor.id,
      action: "task.deleted",
      entityType: "Task",
      entityId: taskId,
      projectId: task.projectId,
      summary: `deleted task "${task.title}" from ${project.name}`,
    });
  });
  return { project };
}

// Acceptance criteria. Text changes follow editTask; ticking follows updateTaskProgress.

export async function addCriterion(actor: Actor, taskId: string, text: string) {
  const { task, project } = await loadTask(actor, taskId);
  if (!can.editTask(actor, project, task)) throw forbidden("You can't edit this task.");
  const count = await db.acceptanceCriterion.count({ where: { taskId } });
  if (count >= 30) throw new AppError("A task can have at most 30 criteria.", "VALIDATION");
  return db.acceptanceCriterion.create({ data: { taskId, text, position: count } });
}

async function loadCriterion(actor: Actor, criterionId: string) {
  const criterion = await db.acceptanceCriterion.findUnique({ where: { id: criterionId } });
  if (!criterion) throw notFound("Criterion");
  return { criterion, ...(await loadTask(actor, criterion.taskId)) };
}

export async function toggleCriterion(actor: Actor, criterionId: string, done: boolean) {
  const { task, project } = await loadCriterion(actor, criterionId);
  if (!can.updateTaskProgress(actor, project, task))
    throw forbidden("Only the assignee or project lead can tick criteria.");
  return db.acceptanceCriterion.update({ where: { id: criterionId }, data: { done } });
}

export async function deleteCriterion(actor: Actor, criterionId: string) {
  const { task, project } = await loadCriterion(actor, criterionId);
  if (!can.editTask(actor, project, task)) throw forbidden("You can't edit this task.");
  await db.acceptanceCriterion.delete({ where: { id: criterionId } });
}

// Dependencies

export async function addDependency(actor: Actor, taskId: string, dependsOnId: string) {
  const { task, project } = await loadTask(actor, taskId);
  if (!can.editTask(actor, project, task)) throw forbidden("You can't edit this task.");
  const prerequisite = await db.task.findUnique({
    where: { id: dependsOnId },
    select: { projectId: true, title: true },
  });
  if (!prerequisite || prerequisite.projectId !== task.projectId) {
    throw new AppError("Dependencies must be tasks in the same project.", "VALIDATION");
  }
  if (await wouldCreateCycle(taskId, dependsOnId)) {
    throw new AppError(
      `"${prerequisite.title}" already depends on this task, so that would create a loop.`,
      "VALIDATION",
    );
  }
  await db.$transaction(async (tx) => {
    await tx.taskDependency.upsert({
      where: { taskId_dependsOnId: { taskId, dependsOnId } },
      create: { taskId, dependsOnId },
      update: {},
    });
    await logActivity(tx, {
      actorId: actor.id,
      action: "task.dependency_added",
      entityType: "Task",
      entityId: taskId,
      projectId: task.projectId,
      summary: `made "${task.title}" depend on "${prerequisite.title}"`,
    });
  });
}

export async function removeDependency(actor: Actor, taskId: string, dependsOnId: string) {
  const { task, project } = await loadTask(actor, taskId);
  if (!can.editTask(actor, project, task)) throw forbidden("You can't edit this task.");
  await db.taskDependency.deleteMany({ where: { taskId, dependsOnId } });
}

// Comments

export async function addComment(actor: Actor, taskId: string, body: string) {
  const { task, project } = await loadTask(actor, taskId);
  if (!can.commentOnTask(actor, project)) throw forbidden();
  return db.$transaction(async (tx) => {
    const comment = await tx.taskComment.create({ data: { taskId, body, authorId: actor.id } });
    await logActivity(tx, {
      actorId: actor.id,
      action: "task.commented",
      entityType: "Task",
      entityId: taskId,
      projectId: task.projectId,
      summary: `commented on "${task.title}"`,
    });
    return comment;
  });
}

export async function deleteComment(actor: Actor, commentId: string) {
  const comment = await db.taskComment.findUnique({ where: { id: commentId } });
  if (!comment) throw notFound("Comment");
  const { project } = await loadTask(actor, comment.taskId);
  if (!can.deleteComment(actor, project, comment)) throw forbidden("You can only delete your own comments.");
  await db.taskComment.delete({ where: { id: commentId } });
  return comment;
}

export async function taskCountsByStatus(actor: Actor, projectId: string) {
  await requireProjectView(actor, projectId);
  const rows = await db.task.groupBy({ by: ["status"], where: { projectId }, _count: { _all: true } });
  const counts: Record<TaskStatus, number> = {
    BACKLOG: 0,
    TODO: 0,
    IN_PROGRESS: 0,
    IN_REVIEW: 0,
    BLOCKED: 0,
    DONE: 0,
  };
  for (const r of rows) counts[r.status] = r._count._all;
  return counts;
}
