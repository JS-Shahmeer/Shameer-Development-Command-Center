import { z } from "zod";
import { id, optionalText, requiredText } from "@/lib/validation";

export const skillInput = z.object({
  name: z.string().trim().min(1, "Skill name is required.").max(40, "Keep skill names under 40 characters."),
  level: z.number().int().min(1).max(5),
});

export const profileInput = z.object({
  userId: id(),
  name: requiredText("Name", 80),
  title: optionalText(80),
  bio: optionalText(2000),
  capacityHours: z
    .number({ error: "Enter weekly hours." })
    .int("Use whole hours.")
    .min(0, "Capacity can't be negative.")
    .max(80, "Capacity can be at most 80 hours a week.")
    .optional(),
  skills: z
    .array(skillInput)
    .max(30, "Add at most 30 skills.")
    .refine((list) => new Set(list.map((s) => s.name.toLowerCase())).size === list.length, {
      message: "Each skill can only be listed once.",
    }),
});

export type ProfileInput = z.infer<typeof profileInput>;

export const SKILL_LEVELS: Record<number, string> = {
  1: "Learning",
  2: "Familiar",
  3: "Comfortable",
  4: "Strong",
  5: "Expert",
};
