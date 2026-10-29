"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { ActionResult, FieldErrors } from "@/lib/action";

/**
 * Runs a Server Action, tracks pending state and field errors, and shows a toast.
 * Resolves to `{ data }` on success, or null on failure.
 */
export function useServerAction<I, T>(action: (input: I) => Promise<ActionResult<T>>) {
  const [pending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const run = (input: I, opts: { success?: string } = {}) =>
    new Promise<{ data: T } | null>((resolve) => {
      startTransition(async () => {
        try {
          const result = await action(input);
          if (result.ok) {
            setFieldErrors({});
            if (opts.success) toast.success(opts.success);
            resolve({ data: result.data });
          } else {
            setFieldErrors(result.fieldErrors ?? {});
            toast.error(result.error);
            resolve(null);
          }
        } catch {
          toast.error("Network error. Check your connection and try again.");
          resolve(null);
        }
      });
    });

  return { run, pending, fieldErrors, setFieldErrors };
}
