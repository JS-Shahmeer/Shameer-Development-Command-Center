"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { FormField } from "@/components/shared/form-field";
import { useServerAction } from "@/hooks/use-server-action";
import { generateBreakdownAction } from "../actions";
import { MAX_REQUIREMENT_LENGTH } from "../schemas";

export function RequirementForm({ projectId, projectSlug }: { projectId: string; projectSlug: string }) {
  const router = useRouter();
  const { run, pending, fieldErrors } = useServerAction(generateBreakdownAction);
  const [requirement, setRequirement] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const result = await run({ projectId, requirement }, { success: "Draft ready for review" });
    if (result) router.push(`/projects/${projectSlug}/breakdown/${result.data.id}`);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3" noValidate>
      <FormField
        id="requirement"
        label="Client requirement"
        required
        error={fieldErrors.requirement}
        hint="Paste the brief, email or spec. Nothing is created until you review and approve the draft."
      >
        <Textarea
          id="requirement"
          rows={10}
          value={requirement}
          onChange={(e) => setRequirement(e.target.value)}
          maxLength={MAX_REQUIREMENT_LENGTH}
          placeholder="e.g. Customers should be able to reset their password from the login page by email…"
          aria-invalid={Boolean(fieldErrors.requirement)}
          disabled={pending}
        />
      </FormField>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-muted text-xs tabular-nums">
          {requirement.length.toLocaleString()} / {MAX_REQUIREMENT_LENGTH.toLocaleString()}
        </span>
        <div className="flex items-center gap-3">
          {pending && (
            <span className="text-muted text-xs" role="status">
              Drafting tasks. This can take up to a minute.
            </span>
          )}
          <Button type="submit" loading={pending}>
            <Sparkles /> Draft tasks
          </Button>
        </div>
      </div>
    </form>
  );
}
