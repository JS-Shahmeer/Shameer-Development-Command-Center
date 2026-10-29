import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { AppError, forbidden, notFound } from "@/lib/errors";
import { can, visibleProjectsWhere, type Actor, type ProjectAccess } from "@/lib/permissions";
import { slugify } from "@/lib/utils";
import type { ProjectInput } from "./schemas";
import { projectListFilter } from "./schemas";
import type { z } from "zod";

const accessSelect = {
  id: true,
  name: true,
  leadId: true,
  members: { select: { userId: true, role: true } },
} satisfies Prisma.ProjectSelect;

async function loadAccess(projectId: string) {
  const project = await db.project.findUnique({ where: { id: projectId }, select: accessSelect });
  if (!project) throw notFound("Project");
  return project;
}

/** Loads a project's access info and throws unless the actor may view it. */
export async function requireProjectView(actor: Actor, projectId: string) {
  const project = await loadAccess(projectId);
  // Hide existence of projects the actor can't see.
  if (!can.viewProject(actor, project)) throw notFound("Project");
  return project;
}

async function requireProjectEdit(actor: Actor, projectId: string) {
  const project = await requireProjectView(actor, projectId);
  if (!can.editProject(actor, project)) {
    throw forbidden("Only an admin or this project's lead can change it.");
  }
  return project;
}

async function assertValidLead(leadId: string | null) {
  if (!leadId) return;
  const lead = await db.user.findUnique({ where: { id: leadId }, select: { role: true, isActive: true } });
  if (!lead || !lead.isActive) throw new AppError("The selected lead doesn't exist.", "VALIDATION");
  if (!can.beProjectLead(lead)) {
    throw new AppError("Only admins and project leads can lead a project.", "VALIDATION");
  }
}

async function assertValidClient(clientId: string | null) {
  if (!clientId) return;
  const client = await db.client.findUnique({ where: { id: clientId }, select: { id: true } });
  if (!client) throw new AppError("The selected client doesn't exist.", "VALIDATION");
}

async function uniqueSlug(name: string) {
  const base = slugify(name) || "project";
  let slug = base;
  for (let n = 2; await db.project.findUnique({ where: { slug }, select: { id: true } }); n++) {
    slug = `${base}-${n}`;
  }
  return slug;
}

export async function listProjects(actor: Actor, rawFilter: z.input<typeof projectListFilter> = {}) {
  const filter = projectListFilter.parse(rawFilter);
  const where: Prisma.ProjectWhereInput = {
    AND: [
      visibleProjectsWhere(actor),
      filter.archived ? { archivedAt: { not: null } } : { archivedAt: null },
      filter.status ? { status: filter.status } : {},
      filter.q
        ? {
            OR: [
              { name: { contains: filter.q, mode: "insensitive" } },
              { client: { name: { contains: filter.q, mode: "insensitive" } } },
              { technologies: { has: filter.q } },
            ],
          }
        : {},
    ],
  };

  return db.project.findMany({
    where,
    orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { updatedAt: "desc" }],
    include: {
      client: { select: { id: true, name: true } },
      lead: { select: { id: true, name: true, email: true, image: true } },
      _count: { select: { members: true, notes: true } },
    },
  });
}

export async function getProjectBySlug(actor: Actor, slug: string) {
  const project = await db.project.findUnique({
    where: { slug },
    include: {
      client: true,
      lead: { select: { id: true, name: true, email: true, image: true, role: true } },
      members: {
        orderBy: [{ role: "asc" }, { createdAt: "asc" }],
        include: {
          user: { select: { id: true, name: true, email: true, image: true, role: true, title: true } },
        },
      },
      notes: {
        orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
        include: { author: { select: { id: true, name: true, email: true, image: true } } },
      },
    },
  });
  if (!project || !can.viewProject(actor, project)) throw notFound("Project");

  const access: ProjectAccess = project;
  return {
    project,
    permissions: {
      edit: can.editProject(actor, access),
      manageMembers: can.manageMembers(actor, access),
      createNote: can.createNote(actor, access),
    },
  };
}

export async function createProject(actor: Actor, input: ProjectInput) {
  if (!can.createProject(actor)) throw forbidden("Only admins and project leads can create projects.");

  // A lead creating a project leads it unless they pick someone else.
  const leadId = input.leadId ?? (actor.role === "LEAD" ? actor.id : null);
  await Promise.all([assertValidLead(leadId), assertValidClient(input.clientId)]);
  const slug = await uniqueSlug(input.name);

  return db.$transaction(async (tx) => {
    const project = await tx.project.create({
      data: {
        ...input,
        leadId,
        slug,
        members: leadId ? { create: { userId: leadId, role: "LEAD" } } : undefined,
      },
    });
    await logActivity(tx, {
      actorId: actor.id,
      action: "project.created",
      entityType: "Project",
      entityId: project.id,
      projectId: project.id,
      summary: `created project ${project.name}`,
    });
    return project;
  });
}

export async function updateProject(actor: Actor, projectId: string, input: ProjectInput) {
  const current = await requireProjectEdit(actor, projectId);
  await Promise.all([assertValidLead(input.leadId), assertValidClient(input.clientId)]);

  return db.$transaction(async (tx) => {
    const project = await tx.project.update({ where: { id: projectId }, data: input });

    if (input.leadId !== current.leadId) {
      if (current.leadId) {
        await tx.projectMember.updateMany({
          where: { projectId, userId: current.leadId, role: "LEAD" },
          data: { role: "MEMBER" },
        });
      }
      if (input.leadId) {
        await tx.projectMember.upsert({
          where: { projectId_userId: { projectId, userId: input.leadId } },
          create: { projectId, userId: input.leadId, role: "LEAD" },
          update: { role: "LEAD" },
        });
      }
    }

    await logActivity(tx, {
      actorId: actor.id,
      action: "project.updated",
      entityType: "Project",
      entityId: projectId,
      projectId,
      summary: `updated project ${project.name}`,
    });
    return project;
  });
}

export async function setProjectArchived(actor: Actor, projectId: string, archived: boolean) {
  await requireProjectEdit(actor, projectId);
  return db.$transaction(async (tx) => {
    const project = await tx.project.update({
      where: { id: projectId },
      data: { archivedAt: archived ? new Date() : null },
    });
    await logActivity(tx, {
      actorId: actor.id,
      action: archived ? "project.archived" : "project.restored",
      entityType: "Project",
      entityId: projectId,
      projectId,
      summary: `${archived ? "archived" : "restored"} project ${project.name}`,
    });
    return project;
  });
}

export async function addProjectMember(
  actor: Actor,
  input: { projectId: string; userId: string; role: "LEAD" | "MEMBER" },
) {
  const project = await requireProjectEdit(actor, input.projectId);
  const user = await db.user.findUnique({ where: { id: input.userId } });
  if (!user || !user.isActive) throw new AppError("That person isn't an active user.", "VALIDATION");
  if (input.role === "LEAD" && !can.beProjectLead(user)) {
    throw new AppError("Only admins and project leads can be a project lead.", "VALIDATION");
  }

  return db.$transaction(async (tx) => {
    const member = await tx.projectMember.upsert({
      where: { projectId_userId: { projectId: input.projectId, userId: input.userId } },
      create: input,
      update: { role: input.role },
    });
    await logActivity(tx, {
      actorId: actor.id,
      action: "project.member_added",
      entityType: "ProjectMember",
      entityId: member.id,
      projectId: input.projectId,
      summary: `added ${user.name ?? user.email} to ${project.name}`,
    });
    return member;
  });
}

export async function removeProjectMember(actor: Actor, input: { projectId: string; userId: string }) {
  const project = await requireProjectEdit(actor, input.projectId);
  if (project.leadId === input.userId) {
    throw new AppError("Change the project lead before removing them.", "VALIDATION");
  }
  const member = await db.projectMember.findUnique({
    where: { projectId_userId: input },
    include: { user: { select: { name: true, email: true } } },
  });
  if (!member) throw notFound("Member");

  await db.$transaction(async (tx) => {
    await tx.projectMember.delete({ where: { id: member.id } });
    await logActivity(tx, {
      actorId: actor.id,
      action: "project.member_removed",
      entityType: "ProjectMember",
      entityId: member.id,
      projectId: input.projectId,
      summary: `removed ${member.user.name ?? member.user.email} from ${project.name}`,
    });
  });
}
