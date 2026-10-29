import { z } from "zod";

// Form helpers: empty strings from inputs become null so optional columns stay clean.

export const requiredText = (label: string, max = 200) =>
  z
    .string({ error: `${label} is required.` })
    .trim()
    .min(1, `${label} is required.`)
    .max(max, `${label} must be ${max} characters or fewer.`);

export const optionalText = (max = 2000) =>
  z
    .string()
    .trim()
    .max(max, `Must be ${max} characters or fewer.`)
    .optional()
    .nullable()
    .transform((v) => v || null);

export const optionalUrl = () =>
  z
    .string()
    .trim()
    .max(500)
    .optional()
    .nullable()
    .refine((v) => !v || (/^https?:\/\//i.test(v) && URL.canParse(v)), {
      message: "Enter a full URL starting with http:// or https://",
    })
    .transform((v) => v || null);

export const optionalEmail = () =>
  z
    .string()
    .trim()
    .toLowerCase()
    .optional()
    .nullable()
    .refine((v) => !v || z.email().safeParse(v).success, { message: "Enter a valid email." })
    .transform((v) => v || null);

export const optionalDate = () =>
  z
    .string()
    .trim()
    .optional()
    .nullable()
    .refine((v) => !v || !Number.isNaN(Date.parse(v)), { message: "Enter a valid date." })
    .transform((v) => (v ? new Date(v) : null));

export const optionalId = () =>
  z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((v) => v || null);

export const id = () => z.string().trim().min(1, "Missing id.");
