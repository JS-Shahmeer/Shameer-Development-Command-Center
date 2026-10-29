import type { Metadata } from "next";
import Link from "next/link";
import { differenceInCalendarDays } from "date-fns";
import {
  Activity,
  AlarmClock,
  CalendarClock,
  FolderKanban,
  ListTodo,
  OctagonAlert,
  Plus,
} from "lucide-react";
import type { TaskPriority, TaskStatus } from "@prisma/client";
import { requireUser } from "@/lib/session";
import { can } from "@/lib/permissions";
import { cn, displayName } from "@/lib/utils";
import { getDashboard } from "@/features/dashboard/service";
import { PriorityLabel } from "@/features/tasks/components/badges";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { RelativeTime, formatDate } from "@/components/shared/relative-time";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Dashboard" };

type DueProject = {
  id: string;
  name: string;
  slug: string;
  dueDate: Date | null;
  client: { name: string } | null;
};
type TaskRow = {
  id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: Date | null;
  blockedReason: string | null;
  project: { name: string; slug: string };
  assignee: { id: string; name: string | null; email: string; image: string | null } | null;
};

function dueText(date: Date | null, today: Date) {
  if (!date) return "No due date";
  const days = differenceInCalendarDays(date, today);
  if (days < 0) return `${-days}d overdue`;
  if (days === 0) return "Due today";
  return `In ${days}d`;
}

function ProjectDueList({ projects, today }: { projects: DueProject[]; today: Date }) {
  return (
    <ul className="divide-y">
      {projects.map((p) => {
        const late = p.dueDate && p.dueDate < today;
        return (
          <li key={p.id} className="flex items-center justify-between gap-3 py-2.5">
            <div className="min-w-0">
              <Link
                href={`/projects/${p.slug}`}
                className="block truncate text-sm font-medium hover:underline"
              >
                {p.name}
              </Link>
              <p className="text-muted truncate text-xs">{p.client?.name ?? "No client"}</p>
            </div>
            <div className="shrink-0 text-right text-xs">
              <p className={late ? "text-danger font-medium" : ""}>{dueText(p.dueDate, today)}</p>
              <p className="text-muted">{formatDate(p.dueDate)}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function TaskRows({
  tasks,
  today,
  showReason,
  showAssignee,
}: {
  tasks: TaskRow[];
  today: Date;
  showReason?: boolean;
  showAssignee?: boolean;
}) {
  return (
    <ul className="divide-y">
      {tasks.map((t) => (
        <li key={t.id} className="flex items-start gap-3 py-2.5">
          <div className="min-w-0 flex-1">
            <Link href={`/tasks/${t.id}`} className="block truncate text-sm font-medium hover:underline">
              {t.title}
            </Link>
            <p className="text-muted truncate text-xs">
              {t.project.name}
              {showAssignee && ` · ${t.assignee ? displayName(t.assignee) : "Unassigned"}`}
            </p>
            {showReason && t.blockedReason && (
              <p className="text-danger mt-1 line-clamp-2 text-xs">{t.blockedReason}</p>
            )}
          </div>
          <div className="flex shrink-0 flex-col items-end gap-0.5 text-xs">
            <PriorityLabel priority={t.priority} />
            <span className={cn(t.dueDate && t.dueDate < today ? "text-danger font-medium" : "text-muted")}>
              {dueText(t.dueDate, today)}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}

function Section({
  icon: Icon,
  tone,
  title,
  href,
  children,
}: {
  icon: typeof Activity;
  tone: string;
  title: string;
  href?: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon className={cn("size-4", tone)} aria-hidden /> {title}
        </CardTitle>
        {href && (
          <Link href={href} className="text-primary text-xs hover:underline">
            View all
          </Link>
        )}
      </CardHeader>
      <CardContent className="py-1">{children}</CardContent>
    </Card>
  );
}

const Empty = ({ children }: { children: React.ReactNode }) => (
  <p className="text-muted py-3 text-sm">{children}</p>
);

export default async function DashboardPage() {
  const user = await requireUser();
  const data = await getDashboard(user);
  const today = new Date();
  const totalProjects =
    data.counts.active + data.counts.planning + data.counts.onHold + data.counts.completed;

  const stats = [
    { label: "Active projects", value: data.counts.active, href: "/projects?status=ACTIVE" },
    { label: "My open tasks", value: data.tasks.counts.mine, href: "/tasks" },
    {
      label: "Overdue tasks",
      value: data.tasks.counts.overdue,
      danger: data.tasks.counts.overdue > 0,
      href: "/tasks?who=all",
    },
    {
      label: "Blocked tasks",
      value: data.tasks.counts.blocked,
      danger: data.tasks.counts.blocked > 0,
      href: "/tasks?who=all&status=BLOCKED",
    },
  ];

  return (
    <>
      <PageHeader
        title={`Welcome back${user.name ? `, ${user.name.split(" ")[0]}` : ""}`}
        description="What needs attention across your projects."
        actions={
          can.createProject(user) && (
            <Button asChild>
              <Link href="/projects/new">
                <Plus /> New project
              </Link>
            </Button>
          )
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <Link
            key={s.label}
            href={s.href}
            className="bg-surface hover:border-primary/40 rounded-lg border p-4 transition-colors"
          >
            <p className="text-muted text-xs">{s.label}</p>
            <p className={cn("mt-1 text-2xl font-semibold tabular-nums", s.danger && "text-danger")}>
              {s.value}
            </p>
          </Link>
        ))}
      </div>

      {totalProjects === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title="No projects yet"
          description={
            can.createProject(user)
              ? "Create your first project to start tracking tasks, deadlines and activity."
              : "You haven't been added to any projects yet. Ask your project lead to add you."
          }
          action={
            can.createProject(user) && (
              <Button asChild>
                <Link href="/projects/new">
                  <Plus /> New project
                </Link>
              </Button>
            )
          }
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-4">
            <Section
              icon={OctagonAlert}
              tone="text-danger"
              title="Blockers"
              href="/tasks?who=all&status=BLOCKED"
            >
              {data.tasks.blocked.length ? (
                <TaskRows tasks={data.tasks.blocked} today={today} showReason showAssignee />
              ) : (
                <Empty>Nothing is blocked.</Empty>
              )}
            </Section>
            <Section icon={AlarmClock} tone="text-danger" title="Overdue tasks" href="/tasks?who=all">
              {data.tasks.overdue.length ? (
                <TaskRows tasks={data.tasks.overdue} today={today} showAssignee />
              ) : (
                <Empty>No overdue tasks.</Empty>
              )}
            </Section>
          </div>
          <div className="space-y-4">
            <Section icon={ListTodo} tone="text-primary" title="My next tasks" href="/tasks">
              {data.tasks.mine.length ? (
                <TaskRows tasks={data.tasks.mine} today={today} />
              ) : (
                <Empty>Nothing assigned to you.</Empty>
              )}
            </Section>
            <Section icon={CalendarClock} tone="text-primary" title="Project deadlines">
              {data.overdue.length + data.upcoming.length ? (
                <ProjectDueList projects={[...data.overdue, ...data.upcoming]} today={today} />
              ) : (
                <Empty>No project deadlines in the next 3 weeks.</Empty>
              )}
            </Section>
          </div>
          <Section icon={Activity} tone="text-muted" title="Recent activity">
            {data.activity.length ? (
              <ul className="divide-y">
                {data.activity.map((a) => (
                  <li key={a.id} className="flex items-start gap-3 py-2.5 text-sm">
                    {a.actor ? (
                      <Avatar user={a.actor} className="mt-0.5 size-6" />
                    ) : (
                      <span className="size-6" />
                    )}
                    <p className="min-w-0 flex-1">
                      <span className="font-medium">{a.actor ? displayName(a.actor) : "Someone"}</span>{" "}
                      <span className="text-muted">{a.summary}</span>
                      <span className="text-muted block text-xs">
                        <RelativeTime date={a.createdAt} />
                      </span>
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>No activity yet.</Empty>
            )}
          </Section>
        </div>
      )}
    </>
  );
}
