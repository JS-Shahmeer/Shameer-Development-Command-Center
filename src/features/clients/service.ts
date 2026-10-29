import { db } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { forbidden, notFound } from "@/lib/errors";
import { can, type Actor } from "@/lib/permissions";
import type { ClientInput } from "./schemas";

const requireManage = (actor: Actor) => {
  if (!can.manageClients(actor)) throw forbidden("Only admins and project leads can manage clients.");
};

export async function listClients(actor: Actor, q?: string) {
  requireManage(actor);
  return db.client.findMany({
    where: q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { company: { contains: q, mode: "insensitive" } },
            { contactName: { contains: q, mode: "insensitive" } },
          ],
        }
      : undefined,
    orderBy: { name: "asc" },
    include: { _count: { select: { projects: { where: { archivedAt: null } } } } },
  });
}

/** Minimal client list for the project form's picker. */
export async function listClientOptions(actor: Actor) {
  requireManage(actor);
  return db.client.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });
}

export async function createClient(actor: Actor, input: ClientInput) {
  requireManage(actor);
  return db.$transaction(async (tx) => {
    const client = await tx.client.create({ data: input });
    await logActivity(tx, {
      actorId: actor.id,
      action: "client.created",
      entityType: "Client",
      entityId: client.id,
      summary: `added client ${client.name}`,
    });
    return client;
  });
}

export async function updateClient(actor: Actor, clientId: string, input: ClientInput) {
  requireManage(actor);
  const existing = await db.client.findUnique({ where: { id: clientId }, select: { id: true } });
  if (!existing) throw notFound("Client");
  return db.$transaction(async (tx) => {
    const client = await tx.client.update({ where: { id: clientId }, data: input });
    await logActivity(tx, {
      actorId: actor.id,
      action: "client.updated",
      entityType: "Client",
      entityId: client.id,
      summary: `updated client ${client.name}`,
    });
    return client;
  });
}

/** Deleting a client keeps its projects; they simply lose the client link. */
export async function deleteClient(actor: Actor, clientId: string) {
  if (!can.deleteClient(actor)) throw forbidden("Only admins can delete clients.");
  const client = await db.client.findUnique({ where: { id: clientId } });
  if (!client) throw notFound("Client");
  await db.$transaction(async (tx) => {
    await tx.client.delete({ where: { id: clientId } });
    await logActivity(tx, {
      actorId: actor.id,
      action: "client.deleted",
      entityType: "Client",
      entityId: clientId,
      summary: `deleted client ${client.name}`,
    });
  });
}
