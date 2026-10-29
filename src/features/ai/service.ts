import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { AppError, forbidden, notFound } from "@/lib/errors";
import { can, isProjectMember, type Actor } from "@/lib/permissions";
import { requireProjectView } from "@/features/projects/service";
import { draftSchema, findCycle, toDraft, type Draft } from "./schemas";
import type { BreakdownGenerator } from "./claude";

/** Generations allowed per person per hour, to keep API spend predictable. */
export const HOURLY_LIMIT = 10;

async function requireManage(actor: Actor, projectId: string) {
  const project = await requireProjectView(actor, projectId);
  if (!can.manageTasks(actor, project)) {
    throw forbidden("Only admins and this project's lead can use AI task breakdown.");
  }
  return project;
}

async function loadBreakdown(actor: Actor, breakdownId: string) {
  const breakdown = await db.aiBreakdown.findUnique({ where: { id: breakdownId } });
  if (!breakdown) throw notFound("Breakdown");
  const project = await requireManage(actor, breakdown.projectId).catch((e) => {
    // Viewers who can't manage get a 404 rather than learning the draft exists.
    if (e instanceof AppError && e.code === "FORBIDDEN") throw notFound("Breakdown");
    throw e;
  });
  return { breakdown, project };
}

const requireDraft = (status: string) => {
  if (status !== "DRAFT")
    throw new AppError("This breakdown has already been approved or discarded.", "CONFLICT");
};

export async function listBreakdowns(actor: Actor, projectId: string) {
  await requireManage(actor, projectId);
  return db.aiBreakdown.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      status: true,
      requirement: true,
      createdAt: true,
      createdTasks: true,
      createdBy: { select: { name: true, email: true } },
    },
  });
}

export async function getBreakdown(actor: Actor, breakdownId: string) {
  const { breakdown } = await loadBreakdown(actor, breakdownId);
  const project = await db.project.findUniqueOrThrow({
    where: { id: breakdown.projectId },
    select: {
      id: true,
      name: true,
      slug: true,
      members: { select: { user: { select: { id: true, name: true, email: true, isActive: true } } } },
    },
  });
  const parsed = draftSchema.safeParse(breakdown.draft);
  return {
    breakdown: {
      ...breakdown,
      draft: parsed.success ? parsed.data : { summary: "", openQuestions: [], items: [] },
    },
    project: { ...project, members: project.members.map((m) => m.user).filter((u) => u.isActive) },
  };
}

export async function generateBreakdown(
  actor: Actor,
  input: { projectId: string; requirement: string },
  generate: BreakdownGenerator,
) {
  const project = await requireManage(actor, input.projectId);

  const recent = await db.aiBreakdown.count({
    where: { createdById: actor.id, createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } },
  });
  if (recent >= HOURLY_LIMIT) {
    throw new AppError(
      `You've used AI breakdown ${HOURLY_LIMIT} times in the last hour. Try again later.`,
      "CONFLICT",
    );
  }

  const details = await db.project.findUniqueOrThrow({
    where: { id: input.projectId },
    select: {
      description: true,
      technologies: true,
      tasks: {
        where: { status: { not: "DONE" } },
        select: { title: true },
        take: 100,
        orderBy: { createdAt: "desc" },
      },
    },
  });

  const result = await generate({
    projectName: project.name,
    projectDescription: details.description,
    technologies: details.technologies,
    existingTasks: details.tasks.map((t) => t.title),
    requirement: input.requirement,
  });
  const draft = toDraft(result.output);
  if (!draft.items.length)
    throw new AppError("The AI didn't suggest any tasks. Add more detail and try again.", "VALIDATION");

  return db.$transaction(async (tx) => {
    const breakdown = await tx.aiBreakdown.create({
      data: {
        projectId: input.projectId,
        createdById: actor.id,
        requirement: input.requirement,
        model: result.model,
        draft: draft as unknown as Prisma.InputJsonValue,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
      },
    });
    await logActivity(tx, {
      actorId: actor.id,
      action: "ai.breakdown_generated",
      entityType: "AiBreakdown",
      entityId: breakdown.id,
      projectId: input.projectId,
      summary: `drafted ${draft.items.length} tasks with AI for ${project.name}`,
    });
    return breakdown;
  });
}

export async function saveDraft(actor: Actor, breakdownId: string, draft: Draft) {
  const { breakdown } = await loadBreakdown(actor, breakdownId);
  requireDraft(breakdown.status);
  return db.aiBreakdown.update({
    where: { id: breakdownId },
    data: { draft: draft as unknown as Prisma.InputJsonValue },
  });
}

export async function discardBreakdown(actor: Actor, breakdownId: string) {
  const { breakdown } = await loadBreakdown(actor, breakdownId);
  requireDraft(breakdown.status);
  return db.aiBreakdown.update({ where: { id: breakdownId }, data: { status: "DISCARDED" } });
}

/**
 * Turns the approved rows into real tasks, with criteria and dependencies, in one transaction.
 * The draft the person saw is re-validated here; nothing from the model is trusted unchecked.
 */
export async function approveBreakdown(
  actor: Actor,
  input: { id: string; draft: Draft; status: "BACKLOG" | "TODO" },
) {
  const { breakdown, project } = await loadBreakdown(actor, input.id);
  requireDraft(breakdown.status);

  const items = input.draft.items.filter((i) => i.include);
  if (!items.length) throw new AppError("Tick at least one task to create.", "VALIDATION");
  const included = new Set(items.map((i) => i.ref));

  for (const item of items) {
    const missing = item.dependsOn.filter((r) => !included.has(r));
    if (missing.length) {
      throw new AppError(
        `"${item.title}" depends on ${missing.join(", ")}, which ${missing.length === 1 ? "isn't" : "aren't"} being created. Include it or remove the dependency.`,
        "VALIDATION",
      );
    }
  }
  const cycle = findCycle(items);
  if (cycle)
    throw new AppError(`These tasks depend on each other in a loop: ${cycle.join(" → ")}.`, "VALIDATION");

  const assigneeIds = [...new Set(items.map((i) => i.assigneeId).filter((v): v is string => Boolean(v)))];
  if (assigneeIds.length) {
    const users = await db.user.findMany({
      where: { id: { in: assigneeIds }, isActive: true },
      select: { id: true, role: true },
    });
    const bad = assigneeIds.filter((uid) => {
      const u = users.find((x) => x.id === uid);
      return !u || !isProjectMember(u, project);
    });
    if (bad.length) throw new AppError("Assign tasks only to active members of this project.", "VALIDATION");
  }

  const last = await db.task.findFirst({
    where: { projectId: breakdown.projectId, status: input.status },
    orderBy: { position: "desc" },
    select: { position: true },
  });
  let position = (last?.position ?? 0) + 1;

  return db.$transaction(async (tx) => {
    const ids = new Map<string, string>();
    for (const item of items) {
      const task = await tx.task.create({
        data: {
          projectId: breakdown.projectId,
          title: item.title,
          description: item.description || null,
          priority: item.priority,
          estimateHours: item.estimateHours,
          assigneeId: item.assigneeId,
          reporterId: actor.id,
          status: input.status,
          position: position++,
          criteria: { create: item.acceptanceCriteria.map((text, i) => ({ text, position: i })) },
        },
      });
      ids.set(item.ref, task.id);
    }
    const edges = items.flatMap((item) =>
      item.dependsOn.map((dep) => ({ taskId: ids.get(item.ref)!, dependsOnId: ids.get(dep)! })),
    );
    if (edges.length) await tx.taskDependency.createMany({ data: edges });

    const updated = await tx.aiBreakdown.update({
      where: { id: breakdown.id },
      data: {
        status: "APPROVED",
        draft: input.draft as unknown as Prisma.InputJsonValue,
        approvedById: actor.id,
        approvedAt: new Date(),
        createdTasks: items.length,
      },
    });
    await logActivity(tx, {
      actorId: actor.id,
      action: "ai.breakdown_approved",
      entityType: "AiBreakdown",
      entityId: breakdown.id,
      projectId: breakdown.projectId,
      summary: `approved ${items.length} AI-drafted tasks for ${project.name}`,
    });
    return updated;
  });
}
