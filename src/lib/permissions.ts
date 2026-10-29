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

  // Any project member can raise a task.
  createTask: (actor: Actor, project: ProjectAccess) => can.viewProject(actor, project),

  // Assigning, deleting and editing anyone's task is for admins and the project lead.
  manageTasks: (actor: Actor, project: ProjectAccess) => can.editProject(actor, project),

  // The reporter may still edit the details of a task they raised.
  editTask: (actor: Actor, project: ProjectAccess, task: TaskAccess) =>
    can.manageTasks(actor, project) || (task.reporterId === actor.id && can.viewProject(actor, project)),

  // Status, blockers and acceptance criteria: managers plus the assignee.
  updateTaskProgress: (actor: Actor, project: ProjectAccess, task: TaskAccess) =>
    can.manageTasks(actor, project) || (task.assigneeId === actor.id && can.viewProject(actor, project)),

  commentOnTask: (actor: Actor, project: ProjectAccess) => can.viewProject(actor, project),

  editComment: (actor: Actor, project: ProjectAccess, comment: { authorId: string | null }) =>
    comment.authorId === actor.id && can.viewProject(actor, project),

  deleteComment: (actor: Actor, project: ProjectAccess, comment: { authorId: string | null }) =>
    can.manageTasks(actor, project) || can.editComment(actor, project, comment),

  // Profiles: everyone edits their own; admins edit anyone's. Capacity is set by admins.
  editProfile: (actor: Actor, userId: string) => actor.id === userId || isAdmin(actor),
  setCapacity: (actor: Actor) => isAdmin(actor),

  // Team view: admins see everyone, leads see people on their projects, developers see themselves.
  viewTeam: (actor: Actor) => actor.role === "ADMIN" || actor.role === "LEAD",
};

export type TaskAccess = { assigneeId: string | null; reporterId: string | null };

/** Prisma filter limiting tasks to projects the actor may see. */
export function visibleTasksWhere(actor: Actor): Prisma.TaskWhereInput {
  if (isAdmin(actor)) return { project: { archivedAt: null } };
  return { project: { AND: [visibleProjectsWhere(actor), { archivedAt: null }] } };
}

/** Prisma filter for the users an actor may see on the Team pages. */
export function visibleTeamWhere(actor: Actor): Prisma.UserWhereInput {
  if (isAdmin(actor)) return {};
  if (actor.role === "LEAD") {
    return {
      OR: [
        { id: actor.id },
        {
          memberships: {
            some: { project: { OR: [{ leadId: actor.id }, { members: { some: { userId: actor.id } } }] } },
          },
        },
      ],
    };
  }
  return { id: actor.id };
}

/** Prisma filter limiting projects to the ones the actor may see. */
export function visibleProjectsWhere(actor: Actor): Prisma.ProjectWhereInput {
  if (isAdmin(actor)) return {};
  return { OR: [{ leadId: actor.id }, { members: { some: { userId: actor.id } } }] };
}
