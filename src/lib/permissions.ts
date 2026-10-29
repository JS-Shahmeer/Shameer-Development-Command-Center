import type { ProjectRole, Role } from "@prisma/client";
import type { Prisma } from "@prisma/client";

// Every permission rule lives here so the server enforces one source of truth.
// UI code may call these to hide controls, but services always call them too.

export type Actor = { id: string; role: Role };

export type ProjectAccess = {
  leadId: string | null;
  members: { userId: string; role: ProjectRole }[];
};

export const isAdmin = (actor: Actor) => actor.role === "ADMIN";

export function isProjectMember(actor: Actor, project: ProjectAccess) {
  return project.leadId === actor.id || project.members.some((m) => m.userId === actor.id);
}

export function isProjectLead(actor: Actor, project: ProjectAccess) {
  return (
    project.leadId === actor.id || project.members.some((m) => m.userId === actor.id && m.role === "LEAD")
  );
}

export const can = {
  manageUsers: (actor: Actor) => isAdmin(actor),

  createProject: (actor: Actor) => actor.role === "ADMIN" || actor.role === "LEAD",

  viewProject: (actor: Actor, project: ProjectAccess) => isAdmin(actor) || isProjectMember(actor, project),

  // Developers never edit project settings, even if listed as a project lead.
  editProject: (actor: Actor, project: ProjectAccess) =>
    isAdmin(actor) || (actor.role === "LEAD" && isProjectLead(actor, project)),

  manageMembers: (actor: Actor, project: ProjectAccess) => can.editProject(actor, project),

  createNote: (actor: Actor, project: ProjectAccess) => can.viewProject(actor, project),

  editNote: (actor: Actor, project: ProjectAccess, note: { authorId: string | null }) =>
    can.editProject(actor, project) || (note.authorId === actor.id && can.viewProject(actor, project)),

  manageClients: (actor: Actor) => actor.role === "ADMIN" || actor.role === "LEAD",

  deleteClient: (actor: Actor) => isAdmin(actor),

  // Only admins and leads may be made project lead.
  beProjectLead: (user: { role: Role }) => user.role === "ADMIN" || user.role === "LEAD",
};

/** Prisma filter limiting projects to the ones the actor may see. */
export function visibleProjectsWhere(actor: Actor): Prisma.ProjectWhereInput {
  if (isAdmin(actor)) return {};
  return { OR: [{ leadId: actor.id }, { members: { some: { userId: actor.id } } }] };
}
