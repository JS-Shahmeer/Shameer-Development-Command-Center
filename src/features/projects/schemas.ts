import { z } from "zod";
import { id, optionalDate, optionalId, optionalText, optionalUrl, requiredText } from "@/lib/validation";

export const PROJECT_STATUSES = ["PLANNING", "ACTIVE", "ON_HOLD", "COMPLETED"] as const;

export const projectStatusLabel: Record<(typeof PROJECT_STATUSES)[number], string> = {
  PLANNING: "Planning",
  ACTIVE: "Active",
  ON_HOLD: "On hold",
  COMPLETED: "Completed",
};

export const projectInput = z
  .object({
    name: requiredText("Project name", 120),
    description: optionalText(5000),
    status: z.enum(PROJECT_STATUSES, { error: "Choose a status." }),
    clientId: optionalId(),
    leadId: optionalId(),
    startDate: optionalDate(),
    dueDate: optionalDate(),
    repoUrl: optionalUrl(),
    stagingUrl: optionalUrl(),
    productionUrl: optionalUrl(),
    technologies: z
      .array(z.string().trim().min(1).max(40, "Each technology must be 40 characters or fewer."))
      .max(20, "Add at most 20 technologies.")
      .default([])
      .transform((list) => [...new Set(list)]),
  })
  .refine((p) => !p.startDate || !p.dueDate || p.dueDate >= p.startDate, {
    message: "Due date can't be before the start date.",
    path: ["dueDate"],
  });

export type ProjectInput = z.infer<typeof projectInput>;
export type ProjectFormValues = z.input<typeof projectInput>;

export const updateProjectInput = z.object({ id: id(), data: projectInput });

export const archiveProjectInput = z.object({ id: id(), archived: z.boolean() });

export const memberInput = z.object({
  projectId: id(),
  userId: id(),
  role: z.enum(["LEAD", "MEMBER"]).default("MEMBER"),
});

export const removeMemberInput = z.object({ projectId: id(), userId: id() });

export const projectListFilter = z.object({
  q: z.string().trim().max(100).optional(),
  status: z.enum(PROJECT_STATUSES).optional(),
  archived: z.boolean().optional(),
});
