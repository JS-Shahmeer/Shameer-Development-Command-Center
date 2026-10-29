import { db } from "@/lib/db";
import {
  can,
  visibleProjectsWhere,
  visibleTasksWhere,
  visibleTeamWhere,
  type Actor,
} from "@/lib/permissions";

export const MIN_QUERY_LENGTH = 2;
const PER_GROUP = 8;

/** A short excerpt of `text` centred on the first match of `q`. */
export function snippet(text: string | null | undefined, q: string, radius = 60) {
  if (!text) return null;
  const flat = text.replace(/\s+/g, " ").trim();
  const at = flat.toLowerCase().indexOf(q.toLowerCase());
  if (at < 0) return flat.length > radius * 2 ? `${flat.slice(0, radius * 2)}…` : flat;
  const start = Math.max(0, at - radius);
  const end = Math.min(flat.length, at + q.length + radius);
  return `${start > 0 ? "…" : ""}${flat.slice(start, end)}${end < flat.length ? "…" : ""}`;
}

/**
 * Searches everything the actor is allowed to see. Each group runs its own
 * permission-scoped query, so results never leak across projects.
 */
export async function globalSearch(actor: Actor, rawQuery: string) {
  const q = rawQuery.trim().slice(0, 100);
  if (q.length < MIN_QUERY_LENGTH) return null;
  const like = { contains: q, mode: "insensitive" as const };

  const [projects, tasks, notes, clients, people] = await Promise.all([
    db.project.findMany({
      where: {
        AND: [
          visibleProjectsWhere(actor),
          {
            OR: [
              { name: like },
              { description: like },
              { technologies: { has: q } },
              { client: { name: like } },
            ],
          },
        ],
      },
      orderBy: [{ archivedAt: { sort: "desc", nulls: "first" } }, { updatedAt: "desc" }],
      take: PER_GROUP,
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        description: true,
        archivedAt: true,
        client: { select: { name: true } },
      },
    }),
    db.task.findMany({
      where: { AND: [visibleTasksWhere(actor), { OR: [{ title: like }, { description: like }] }] },
      orderBy: { updatedAt: "desc" },
      take: PER_GROUP,
      select: {
        id: true,
        title: true,
        status: true,
        description: true,
        project: { select: { name: true } },
      },
    }),
    db.note.findMany({
      where: {
        AND: [
          { project: { AND: [visibleProjectsWhere(actor), { archivedAt: null }] } },
          { OR: [{ title: like }, { body: like }] },
        ],
      },
      orderBy: { updatedAt: "desc" },
      take: PER_GROUP,
      select: { id: true, title: true, body: true, project: { select: { name: true, slug: true } } },
    }),
    can.manageClients(actor)
      ? db.client.findMany({
          where: { OR: [{ name: like }, { company: like }, { contactName: like }, { email: like }] },
          orderBy: { name: "asc" },
          take: PER_GROUP,
          select: { id: true, name: true, company: true, contactName: true },
        })
      : Promise.resolve([]),
    db.user.findMany({
      where: {
        AND: [
          visibleTeamWhere(actor),
          { isActive: true },
          {
            OR: [
              { name: like },
              { email: like },
              { title: like },
              { skills: { some: { skill: { name: like } } } },
            ],
          },
        ],
      },
      orderBy: { name: "asc" },
      take: PER_GROUP,
      select: { id: true, name: true, email: true, image: true, title: true, role: true },
    }),
  ]);

  return {
    q,
    projects: projects.map((p) => ({ ...p, snippet: snippet(p.description, q) })),
    tasks: tasks.map((t) => ({ ...t, snippet: snippet(t.description, q) })),
    notes: notes.map((n) => ({ ...n, snippet: snippet(n.body, q) })),
    clients,
    people,
    total: projects.length + tasks.length + notes.length + clients.length + people.length,
  };
}
