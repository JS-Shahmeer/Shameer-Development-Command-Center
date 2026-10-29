"use client";

import { useRouter } from "next/navigation";
import type { TaskPriority, TaskStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input, Select, Textarea } from "@/components/ui/input";
import { FormField } from "@/components/shared/form-field";
import { useServerAction } from "@/hooks/use-server-action";
import { createTaskAction, updateTaskAction } from "../actions";
import { TASK_PRIORITIES, taskPriorityLabel, taskStatusLabel, type TaskFormValues } from "../schemas";

export type AssigneeOption = { id: string; name: string | null; email: string };

export type TaskDefaults = {
  id: string;
  title: string;
  description: string | null;
  priority: TaskPriority;
  assigneeId: string | null;
  dueDate: Date | null;
  estimateHours: number | null;
};

const NEW_STATUSES: TaskStatus[] = ["BACKLOG", "TODO", "IN_PROGRESS", "IN_REVIEW"];

/**
 * Create a task (pass projectId) or edit one (pass task).
 * `canAssignOthers` limits the assignee picker to "me" for developers.
 */
export function TaskDialog({
  open,
  onOpenChange,
  projectId,
  task,
  assignees,
  currentUserId,
  canAssignOthers,
  initialStatus = "TODO",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId?: string;
  task?: TaskDefaults;
  assignees: AssigneeOption[];
  currentUserId: string;
  canAssignOthers: boolean;
  initialStatus?: TaskStatus;
}) {
  const router = useRouter();
  const create = useServerAction(createTaskAction);
  const update = useServerAction(updateTaskAction);
  const { pending, fieldErrors } = task ? update : create;
  const err = (k: string) => fieldErrors[`data.${k}`] ?? fieldErrors[k];

  const options = canAssignOthers
    ? assignees
    : assignees.filter((a) => a.id === currentUserId || a.id === task?.assigneeId);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const get = (k: string) => String(f.get(k) ?? "");
    const data: TaskFormValues = {
      title: get("title"),
      description: get("description"),
      priority: get("priority") as TaskPriority,
      assigneeId: get("assigneeId"),
      dueDate: get("dueDate"),
      estimateHours: get("estimateHours"),
    };

    if (task) {
      const ok = await update.run({ id: task.id, data }, { success: "Task saved" });
      if (ok) {
        onOpenChange(false);
        router.refresh();
      }
      return;
    }
    if (!projectId) return;
    const criteria = get("criteria")
      .split("\n")
      .map((l) => l.replace(/^[-*\s[\]x]+/i, "").trim())
      .filter(Boolean);
    const ok = await create.run(
      { projectId, status: get("status") as TaskStatus, data, criteria },
      { success: "Task created" },
    );
    if (ok) {
      onOpenChange(false);
      router.refresh();
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={task ? "Edit task" : "New task"} className="max-w-2xl">
        <form onSubmit={onSubmit} className="space-y-4" noValidate key={task?.id ?? `new-${initialStatus}`}>
          <FormField id="t-title" label="Title" required error={err("title")}>
            <Input
              id="t-title"
              name="title"
              defaultValue={task?.title}
              maxLength={200}
              autoFocus
              aria-invalid={Boolean(err("title"))}
            />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            {!task && (
              <FormField id="t-status" label="Status">
                <Select id="t-status" name="status" defaultValue={initialStatus}>
                  {NEW_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {taskStatusLabel[s]}
                    </option>
                  ))}
                </Select>
              </FormField>
            )}
            <FormField id="t-priority" label="Priority" error={err("priority")}>
              <Select id="t-priority" name="priority" defaultValue={task?.priority ?? "MEDIUM"}>
                {TASK_PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {taskPriorityLabel[p]}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField
              id="t-assignee"
              label="Assignee"
              error={err("assigneeId")}
              hint={
                canAssignOthers
                  ? "Only project members can be assigned."
                  : "You can assign tasks to yourself."
              }
            >
              <Select id="t-assignee" name="assigneeId" defaultValue={task?.assigneeId ?? ""}>
                <option value="">Unassigned</option>
                {options.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.id === currentUserId ? `Me (${a.name ?? a.email})` : (a.name ?? a.email)}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField id="t-due" label="Due date" error={err("dueDate")}>
              <Input
                id="t-due"
                name="dueDate"
                type="date"
                defaultValue={task?.dueDate ? task.dueDate.toISOString().slice(0, 10) : ""}
              />
            </FormField>
            <FormField id="t-estimate" label="Estimate (hours)" error={err("estimateHours")}>
              <Input
                id="t-estimate"
                name="estimateHours"
                type="number"
                min={0}
                max={1000}
                step={0.25}
                defaultValue={task?.estimateHours ?? ""}
                aria-invalid={Boolean(err("estimateHours"))}
              />
            </FormField>
          </div>
          <FormField id="t-description" label="Description" error={err("description")}>
            <Textarea id="t-description" name="description" rows={5} defaultValue={task?.description ?? ""} />
          </FormField>
          {!task && (
            <FormField
              id="t-criteria"
              label="Acceptance criteria"
              error={fieldErrors.criteria}
              hint="One per line. You can tick them off on the task page."
            >
              <Textarea
                id="t-criteria"
                name="criteria"
                rows={4}
                placeholder={"User can reset password by email\nLink expires after 1 hour"}
              />
            </FormField>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={pending}>
              {task ? "Save task" : "Create task"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
