import Link from "next/link";
import { CalendarDays, CheckSquare, Link2, MessageSquare, OctagonAlert } from "lucide-react";
import type { TaskPriority, TaskStatus } from "@prisma/client";
import { Avatar } from "@/components/ui/avatar";
import { formatDate } from "@/components/shared/relative-time";
import { cn, displayName } from "@/lib/utils";
import { PriorityLabel } from "./badges";
import { StatusControl } from "./status-control";

export type TaskCardData = {
  id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: Date | null;
  estimateHours: number | null;
  blockedReason: string | null;
  assignee: { id: string; name: string | null; email: string; image: string | null } | null;
  criteriaDone: number;
  criteriaTotal: number;
  comments: number;
  waitingOn: number;
  canProgress: boolean;
};

export function TaskCard({ task, now }: { task: TaskCardData; now: Date }) {
  const overdue = task.dueDate && task.status !== "DONE" && task.dueDate < now;
  return (
    <article className="bg-surface rounded-md border p-3 shadow-xs">
      <div className="flex items-start justify-between gap-2">
        <Link href={`/tasks/${task.id}`} className="text-sm leading-snug font-medium hover:underline">
          {task.title}
        </Link>
        {task.assignee && <Avatar user={task.assignee} className="size-6 shrink-0 text-[9px]" />}
      </div>
      {task.status === "BLOCKED" && task.blockedReason && (
        <p className="bg-danger/10 text-danger mt-2 flex gap-1.5 rounded px-2 py-1 text-xs">
          <OctagonAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span className="line-clamp-2">{task.blockedReason}</span>
        </p>
      )}
      <div className="text-muted mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        <PriorityLabel priority={task.priority} />
        {task.dueDate && (
          <span className={cn("inline-flex items-center gap-1", overdue && "text-danger font-medium")}>
            <CalendarDays className="size-3.5" aria-hidden /> {formatDate(task.dueDate)}
          </span>
        )}
        {task.criteriaTotal > 0 && (
          <span className="inline-flex items-center gap-1" title="Acceptance criteria met">
            <CheckSquare className="size-3.5" aria-hidden /> {task.criteriaDone}/{task.criteriaTotal}
          </span>
        )}
        {task.comments > 0 && (
          <span className="inline-flex items-center gap-1" title="Comments">
            <MessageSquare className="size-3.5" aria-hidden /> {task.comments}
          </span>
        )}
        {task.waitingOn > 0 && (
          <span
            className="text-warning inline-flex items-center gap-1"
            title="Waiting on unfinished dependencies"
          >
            <Link2 className="size-3.5" aria-hidden /> waiting on {task.waitingOn}
          </span>
        )}
        {task.estimateHours != null && <span>{task.estimateHours}h</span>}
      </div>
      {task.canProgress && (
        <div className="mt-2">
          <StatusControl taskId={task.id} status={task.status} size="sm" />
        </div>
      )}
      <span className="sr-only">Assignee: {task.assignee ? displayName(task.assignee) : "unassigned"}</span>
    </article>
  );
}
