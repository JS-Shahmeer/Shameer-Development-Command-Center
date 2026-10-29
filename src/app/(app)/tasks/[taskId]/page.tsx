import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, OctagonAlert } from "lucide-react";
import { requireUser } from "@/lib/session";
import { orNotFound } from "@/lib/errors";
import { displayName } from "@/lib/utils";
import { getTask } from "@/features/tasks/service";
import { PriorityLabel, TaskStatusBadge } from "@/features/tasks/components/badges";
import { StatusControl } from "@/features/tasks/components/status-control";
import {
  CommentsPanel,
  CriteriaPanel,
  DependenciesPanel,
  TaskDeleteButton,
  TaskEditButton,
} from "@/features/tasks/components/task-detail";
import { PageHeader } from "@/components/shared/page-header";
import { RelativeTime, formatDate } from "@/components/shared/relative-time";
import { Avatar } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = { title: "Task" };

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 text-sm">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  );
}

export default async function TaskPage({ params }: { params: Promise<{ taskId: string }> }) {
  const user = await requireUser();
  const { taskId } = await params;
  const { task, candidates, permissions } = await orNotFound(getTask(user, taskId));
  const assignees = task.project.members.map((m) => m.user);
  const waiting = task.dependsOn.filter((d) => d.dependsOn.status !== "DONE").length;

  return (
    <>
      <Link
        href={`/projects/${task.project.slug}/tasks`}
        className="text-muted hover:text-foreground mb-3 inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" aria-hidden /> {task.project.name} tasks
      </Link>
      <PageHeader
        title={task.title}
        description={
          <span className="flex flex-wrap items-center gap-3">
            <TaskStatusBadge status={task.status} />
            <PriorityLabel priority={task.priority} />
            {waiting > 0 && (
              <span className="text-warning text-xs">
                Waiting on {waiting} unfinished {waiting === 1 ? "task" : "tasks"}
              </span>
            )}
          </span>
        }
        actions={
          <>
            {permissions.edit && (
              <TaskEditButton
                task={{
                  id: task.id,
                  title: task.title,
                  description: task.description,
                  priority: task.priority,
                  assigneeId: task.assigneeId,
                  dueDate: task.dueDate,
                  estimateHours: task.estimateHours,
                }}
                assignees={assignees}
                currentUserId={user.id}
                canAssignOthers={permissions.manage}
              />
            )}
            {permissions.manage && (
              <TaskDeleteButton taskId={task.id} title={task.title} projectSlug={task.project.slug} />
            )}
          </>
        }
      />

      {task.status === "BLOCKED" && task.blockedReason && (
        <div
          role="status"
          className="border-danger/30 bg-danger/10 text-danger mb-4 flex gap-2 rounded-lg border px-4 py-3 text-sm"
        >
          <OctagonAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p>
            <span className="font-medium">Blocked:</span> {task.blockedReason}
          </p>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardContent>
              {task.description ? (
                <p className="text-sm whitespace-pre-wrap">{task.description}</p>
              ) : (
                <p className="text-muted text-sm">No description.</p>
              )}
            </CardContent>
          </Card>
          <CriteriaPanel
            taskId={task.id}
            criteria={task.criteria}
            canEdit={permissions.edit}
            canTick={permissions.progress}
          />
          <CommentsPanel
            taskId={task.id}
            comments={task.comments}
            currentUserId={user.id}
            canComment={permissions.comment}
            canModerate={permissions.manage}
          />
        </div>
        <div className="space-y-4">
          <Card>
            <CardContent className="space-y-3">
              {permissions.progress ? (
                <div>
                  <p className="text-muted mb-1 text-xs font-medium">Status</p>
                  <StatusControl taskId={task.id} status={task.status} />
                </div>
              ) : null}
              <dl className="divide-y">
                <Field label="Assignee">
                  {task.assignee ? (
                    <Link
                      href={`/team/${task.assignee.id}`}
                      className="inline-flex items-center gap-2 hover:underline"
                    >
                      <Avatar user={task.assignee} className="size-5 text-[9px]" />{" "}
                      {displayName(task.assignee)}
                    </Link>
                  ) : (
                    <span className="text-muted">Unassigned</span>
                  )}
                </Field>
                <Field label="Due">{formatDate(task.dueDate)}</Field>
                <Field label="Estimate">{task.estimateHours != null ? `${task.estimateHours}h` : "—"}</Field>
                <Field label="Reporter">{task.reporter ? displayName(task.reporter) : "—"}</Field>
                <Field label="Created">
                  <RelativeTime date={task.createdAt} />
                </Field>
                {task.completedAt && <Field label="Completed">{formatDate(task.completedAt)}</Field>}
              </dl>
            </CardContent>
          </Card>
          <DependenciesPanel
            taskId={task.id}
            dependsOn={task.dependsOn.map((d) => d.dependsOn)}
            dependents={task.dependents.map((d) => d.task)}
            candidates={candidates}
            canEdit={permissions.edit}
          />
        </div>
      </div>
    </>
  );
}
