import { z } from "zod";
import { id } from "@/lib/validation";

export const ROLES = ["ADMIN", "LEAD", "DEVELOPER"] as const;

export const roleLabel: Record<(typeof ROLES)[number], string> = {
  ADMIN: "Admin",
  LEAD: "Project lead",
  DEVELOPER: "Developer",
};

export const inviteInput = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email({ error: "Enter a valid email." })),
  role: z.enum(ROLES, { error: "Choose a role." }),
});

export const inviteIdInput = z.object({ id: id() });
export const changeRoleInput = z.object({ userId: id(), role: z.enum(ROLES) });
export const setActiveInput = z.object({ userId: id(), active: z.boolean() });
