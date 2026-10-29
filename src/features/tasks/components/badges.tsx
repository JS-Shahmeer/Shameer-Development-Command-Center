import type { TaskPriority, TaskStatus } from "@prisma/client";
import { ArrowDown, ArrowUp, ChevronsUp, Minus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { taskPriorityLabel, taskStatusLabel } from "../schemas";

const statusTone = {
  BACKLOG: "neutral",
  TODO: "neutral",
  IN_PROGRESS: "primary",
  IN_REVIEW: "warning",
  BLOCKED: "danger",
  DONE: "success",
} as const;

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  return <Badge tone={statusTone[status]}>{taskStatusLabel[status]}</Badge>;
}

const priorityStyle = {
  URGENT: { icon: ChevronsUp, className: "text-danger" },
  HIGH: { icon: ArrowUp, className: "text-warning" },
  MEDIUM: { icon: Minus, className: "text-muted" },
  LOW: { icon: ArrowDown, className: "text-muted" },
} as const;

export function PriorityLabel({ priority, className }: { priority: TaskPriority; className?: string }) {
  const { icon: Icon, className: tone } = priorityStyle[priority];
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs", tone, className)}>
      <Icon className="size-3.5" aria-hidden />
      {taskPriorityLabel[priority]}
    </span>
  );
}
