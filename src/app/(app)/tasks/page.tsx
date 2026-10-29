import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, ListTodo, Search } from "lucide-react";
import { requireUser } from "@/lib/session";
import { cn, displayName } from "@/lib/utils";
import { listTasks } from "@/features/tasks/service";
import { listProjects } from "@/features/projects/service";
import { TASK_PRIORITIES, TASK_STATUSES, taskPriorityLabel, taskStatusLabel } from "@/features/tasks/schemas";
import { PriorityLabel, TaskStatusBadge } from "@/features/tasks/components/badges";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { formatDate } from "@/components/shared/relative-time";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";

export const metadata: Metadata = { title: "Tasks" };

type Search = { q?: string; status?: string; priority?: string; project?: string; who?: string };

export default async function TasksPage({ searchParams }: { searchParams: Promise<Search> }) {
  const user = await requireUser();
  const p = await searchParams;
  const who = p.who === "all" || p.who === "none" ? p.who : "me";
  const status = TASK_STATUSES.find((s) => s === p.status);
  const priority = TASK_PRIORITIES.find((s) => s === p.priority);
  const q = p.q?.trim() || undefined;

  const [tasks, projects] = await Promise.all([
    listTasks(user, {
      q,
      status,
      priority,
      projectId: p.project || undefined,
      assigneeId: who === "me" ? user.id : who === "none" ? "none" : undefined,
      open: !status,
    }),
    listProjects(user),
  ]);
  const now = new Date();
  const filtered = Boolean(q || status || priority || p.project || who !== "me");

  return (
    <>
      <PageHeader
        title={who === "me" ? "My tasks" : "Tasks"}
        description={
          status
            ? `Showing ${taskStatusLabel[status].toLowerCase()} tasks.`
            : "Open tasks, most urgent first."
        }
      />

      <form role="search" className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-[1fr_repeat(4,10rem)_auto]">
        <div className="relative">
          <Search
            className="text-muted pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2"
            aria-hidden
          />
          <Input
            name="q"
            defaultValue={q}
            placeholder="Search tasks"
            className="pl-8"
            aria-label="Search tasks"
          />
        </div>
        <Select name="who" defaultValue={who} aria-label="Assignee">
          <option value="me">Assigned to me</option>
          <option value="all">Everyone</option>
          <option value="none">Unassigned</option>
        </Select>
        <Select name="status" defaultValue={status ?? ""} aria-label="Status">
          <option value="">All open</option>
          {TASK_STATUSES.map((s) => (
            <option key={s} value={s}>
              {taskStatusLabel[s]}
            </option>
          ))}
        </Select>
        <Select name="priority" defaultValue={priority ?? ""} aria-label="Priority">
          <option value="">Any priority</option>
          {TASK_PRIORITIES.map((s) => (
            <option key={s} value={s}>
              {taskPriorityLabel[s]}
            </option>
          ))}
        </Select>
        <Select name="project" defaultValue={p.project ?? ""} aria-label="Project">
          <option value="">All projects</option>
          {projects.map((pr) => (
            <option key={pr.id} value={pr.id}>
              {pr.name}
            </option>
          ))}
        </Select>
        <Button type="submit" variant="secondary">
          Filter
        </Button>
      </form>

      {tasks.length === 0 ? (
        <EmptyState
          icon={ListTodo}
          title={filtered ? "No tasks match these filters" : "Nothing assigned to you"}
          description={
            filtered ? "Try widening the filters." : "Tasks assigned to you across all projects show up here."
          }
          action={
            filtered ? (
              <Button asChild variant="secondary">
                <Link href="/tasks">Reset filters</Link>
              </Button>
            ) : (
              <Button asChild variant="secondary">
                <Link href="/tasks?who=all">See everyone&apos;s tasks</Link>
              </Button>
            )
          }
        />
      ) : (
        <div className="bg-surface overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="text-muted border-b text-left text-xs">
              <tr>
                <th className="px-4 py-2 font-medium">Task</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="hidden px-4 py-2 font-medium md:table-cell">Priority</th>
                <th className="hidden px-4 py-2 font-medium lg:table-cell">Assignee</th>
                <th className="px-4 py-2 font-medium">Due</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {tasks.map((t) => {
                const overdue = t.dueDate && t.status !== "DONE" && t.dueDate < now;
                return (
                  <tr key={t.id} className="hover:bg-surface-muted/50">
                    <td className="max-w-md px-4 py-2.5">
                      <Link href={`/tasks/${t.id}`} className="block truncate font-medium hover:underline">
                        {t.title}
                      </Link>
                      <Link
                        href={`/projects/${t.project.slug}/tasks`}
                        className="text-muted text-xs hover:underline"
                      >
                        {t.project.name}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5">
                      <TaskStatusBadge status={t.status} />
                    </td>
                    <td className="hidden px-4 py-2.5 md:table-cell">
                      <PriorityLabel priority={t.priority} />
                    </td>
                    <td className="hidden px-4 py-2.5 lg:table-cell">
                      {t.assignee ? (
                        <span className="inline-flex items-center gap-2">
                          <Avatar user={t.assignee} className="size-5 text-[9px]" /> {displayName(t.assignee)}
                        </span>
                      ) : (
                        <span className="text-muted">Unassigned</span>
                      )}
                    </td>
                    <td className={cn("px-4 py-2.5 whitespace-nowrap", overdue && "text-danger font-medium")}>
                      {t.dueDate ? (
                        <span className="inline-flex items-center gap-1">
                          <CalendarDays className="size-3.5" aria-hidden /> {formatDate(t.dueDate)}
                        </span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
