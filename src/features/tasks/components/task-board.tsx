"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import type { TaskStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { TASK_STATUSES, taskStatusLabel } from "../schemas";
import { TaskCard, type TaskCardData } from "./task-card";
import { TaskDialog, type AssigneeOption } from "./task-dialog";

export function TaskBoard({
  projectId,
  tasks,
  assignees,
  currentUserId,
  canCreate,
  canAssignOthers,
}: {
  projectId: string;
  tasks: TaskCardData[];
  assignees: AssigneeOption[];
  currentUserId: string;
  canCreate: boolean;
  canAssignOthers: boolean;
}) {
  const [creating, setCreating] = useState<TaskStatus | null>(null);
  const [mine, setMine] = useState(false);
  const now = useMemo(() => new Date(), []);
  const visible = mine ? tasks.filter((t) => t.assignee?.id === currentUserId) : tasks;

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={mine}
            onChange={(e) => setMine(e.target.checked)}
            className="size-4 accent-[var(--primary)]"
          />
          Only my tasks
        </label>
        {canCreate && (
          <Button onClick={() => setCreating("TODO")}>
            <Plus /> New task
          </Button>
        )}
      </div>

      <div className="-mx-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
        <div className="grid min-w-[1080px] grid-cols-6 gap-3">
          {TASK_STATUSES.map((status) => {
            const column = visible.filter((t) => t.status === status);
            return (
              <section
                key={status}
                aria-label={taskStatusLabel[status]}
                className="bg-surface-muted/60 flex min-h-40 flex-col rounded-lg p-2"
              >
                <header className="mb-2 flex items-center justify-between px-1">
                  <h2 className="text-muted text-xs font-semibold tracking-wide uppercase">
                    {taskStatusLabel[status]} <span className="ml-1 tabular-nums">{column.length}</span>
                  </h2>
                  {canCreate && status !== "BLOCKED" && status !== "DONE" && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-6"
                      aria-label={`New task in ${taskStatusLabel[status]}`}
                      onClick={() => setCreating(status)}
                    >
                      <Plus />
                    </Button>
                  )}
                </header>
                <div className="flex flex-1 flex-col gap-2">
                  {column.map((t) => (
                    <TaskCard key={t.id} task={t} now={now} />
                  ))}
                  {column.length === 0 && (
                    <p className="text-muted px-1 py-4 text-center text-xs">No tasks</p>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </div>

      <TaskDialog
        open={Boolean(creating)}
        onOpenChange={(o) => !o && setCreating(null)}
        projectId={projectId}
        assignees={assignees}
        currentUserId={currentUserId}
        canAssignOthers={canAssignOthers}
        initialStatus={creating ?? "TODO"}
      />
    </>
  );
}
