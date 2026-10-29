import "server-only";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { AppError } from "@/lib/errors";
import { getCurrentUser, type CurrentUser } from "@/lib/session";

export type FieldErrors = Record<string, string[] | undefined>;

export type ActionResult<T = void> =
  { ok: true; data: T } | { ok: false; error: string; fieldErrors?: FieldErrors };

/**
 * Wraps a Server Action: requires an active user, validates input with Zod,
 * and turns thrown errors into a result the client can show as a toast.
 * Permission checks happen inside the handler's service call.
 */
export function createAction<S extends z.ZodType, T>(
  schema: S,
  handler: (input: z.infer<S>, actor: CurrentUser) => Promise<T>,
) {
  return async (raw: z.input<S>): Promise<ActionResult<T>> => {
    const actor = await getCurrentUser();
    if (!actor) return { ok: false, error: "Your session has ended. Please sign in again." };

    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      return {
        ok: false,
        error: "Please fix the highlighted fields.",
        fieldErrors: z.flattenError(parsed.error).fieldErrors as FieldErrors,
      };
    }

    try {
      return { ok: true, data: await handler(parsed.data, actor) };
    } catch (error) {
      if (error instanceof AppError) return { ok: false, error: error.message };
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return { ok: false, error: "That already exists. Use a different value." };
      }
      console.error("Action failed", error);
      return { ok: false, error: "Something went wrong. Please try again." };
    }
  };
}
