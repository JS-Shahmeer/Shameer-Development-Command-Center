import type { Actor, ProjectAccess } from "@/lib/permissions";
import { can } from "@/lib/permissions";
import type { TaskListItem } from "../service";
import type { TaskCardData } from "./task-card";

/** Server-side: shapes a task list row for the client, including the actor's permission. */
export function toCardData(task: TaskListItem, actor: Actor, project: ProjectAccess): TaskCardData {
  return {
    id: task.id,
    title: task.title,
    status: task.status,
    priority: task.priority,
    dueDate: task.dueDate,
    estimateHours: task.estimateHours,
    blockedReason: task.blockedReason,
    assignee: task.assignee,
    criteriaDone: task.criteria.filter((c) => c.done).length,
    criteriaTotal: task.criteria.length,
    comments: task._count.comments,
    waitingOn: task.dependsOn.filter((d) => d.dependsOn.status !== "DONE").length,
    canProgress: can.updateTaskProgress(actor, project, task),
  };
}
