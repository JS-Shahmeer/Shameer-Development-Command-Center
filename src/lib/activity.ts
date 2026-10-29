import type { Prisma, PrismaClient } from "@prisma/client";

type Client = PrismaClient | Prisma.TransactionClient;

export type ActivityInput = {
  actorId: string | null;
  action: string;
  entityType: "User" | "Invite" | "Client" | "Project" | "ProjectMember" | "Note";
  entityId: string;
  projectId?: string | null;
  summary: string;
  metadata?: Prisma.InputJsonValue;
};

export function logActivity(client: Client, input: ActivityInput) {
  return client.activityLog.create({ data: input });
}
