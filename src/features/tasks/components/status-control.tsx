"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { TaskStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Select, Textarea } from "@/components/ui/input";
import { FormField } from "@/components/shared/form-field";
import { useServerAction } from "@/hooks/use-server-action";
import { cn } from "@/lib/utils";
import { setTaskStatusAction } from "../actions";
import { TASK_STATUSES, taskStatusLabel } from "../schemas";

/** Status dropdown; choosing Blocked asks what the blocker is. */
export function StatusControl({
  taskId,
  status,
  className,
  size = "md",
}: {
  taskId: string;
  status: TaskStatus;
  className?: string;
  size?: "sm" | "md";
}) {
  const router = useRouter();
  const { run, pending, fieldErrors } = useServerAction(setTaskStatusAction);
  const [askReason, setAskReason] = useState(false);

  const change = async (next: TaskStatus, blockedReason?: string) => {
    const ok = await run(
      { id: taskId, status: next, blockedReason },
      { success: `Moved to ${taskStatusLabel[next]}` },
    );
    if (ok) router.refresh();
    return Boolean(ok);
  };

  return (
    <>
      <Select
        aria-label="Task status"
        value={status}
        disabled={pending}
        className={cn(size === "sm" ? "h-7 text-xs" : "", className)}
        onChange={(e) => {
          const next = e.target.value as TaskStatus;
          if (next === "BLOCKED") setAskReason(true);
          else void change(next);
        }}
      >
        {TASK_STATUSES.map((s) => (
          <option key={s} value={s}>
            {taskStatusLabel[s]}
          </option>
        ))}
      </Select>

      <Dialog open={askReason} onOpenChange={setAskReason}>
        <DialogContent
          title="What's blocking this task?"
          description="The project lead sees blockers on the dashboard."
        >
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              const reason = String(new FormData(e.currentTarget).get("reason") ?? "");
              if (await change("BLOCKED", reason)) setAskReason(false);
            }}
          >
            <FormField id={`reason-${taskId}`} label="Blocker" required error={fieldErrors.blockedReason}>
              <Textarea
                id={`reason-${taskId}`}
                name="reason"
                rows={3}
                autoFocus
                placeholder="Waiting on API keys from the client"
              />
            </FormField>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setAskReason(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="danger" loading={pending}>
                Mark blocked
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
