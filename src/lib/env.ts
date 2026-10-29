import { z } from "zod";

// Server-only environment variables, checked once at startup so a missing
// secret fails loudly instead of surfacing as a confusing runtime error.
const schema = z
  .object({
    DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
    AUTH_SECRET: z.string().min(1, "AUTH_SECRET is required").optional(),
    AUTH_GITHUB_ID: z.string().optional(),
    AUTH_GITHUB_SECRET: z.string().optional(),
    ADMIN_EMAIL: z.email().optional(),
    AUTH_DEV_LOGIN: z.enum(["true", "false"]).optional(),
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  })
  .refine((e) => e.NODE_ENV !== "production" || Boolean(e.AUTH_SECRET), {
    message: "AUTH_SECRET is required in production",
    path: ["AUTH_SECRET"],
  });

// Treat empty values (as left in a copied .env.example) as unset.
const raw = Object.fromEntries(Object.entries(process.env).filter(([, v]) => v !== ""));
const parsed = schema.safeParse(raw);

if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
  throw new Error(`Invalid environment variables:\n${issues}`);
}

export const env = parsed.data;

export const isGithubAuthConfigured = Boolean(env.AUTH_GITHUB_ID && env.AUTH_GITHUB_SECRET);

// Passwordless "pick a seeded user" login. Only ever available under `next dev`.
export const isDevLoginEnabled = env.NODE_ENV === "development" && env.AUTH_DEV_LOGIN === "true";
