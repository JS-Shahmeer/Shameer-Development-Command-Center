import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { requireUser } from "@/lib/session";
import { cn, displayName } from "@/lib/utils";
import {
  getReport,
  parseDay,
  reportToMarkdown,
  toDayString,
  type ReportPeriod,
} from "@/features/reports/service";
import { listProjects } from "@/features/projects/service";
import { ReportActions } from "@/features/reports/components/copy-markdown";
import { PriorityLabel } from "@/features/tasks/components/badges";
import { PageHeader } from "@/components/shared/page-header";
import { RelativeTime, formatDate } from "@/components/shared/relative-time";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";

export const metadata: Metadata = { title: "Reports" };

const DAY = 24 * 60 * 60 * 1000;

type TaskLine = {
  id: string;
  title: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  dueDate: Date | null;
  completedAt: Date | null;
  blockedReason: string | null;
  project: { name: string };
  assignee: { name: string | null; email: string } | null;
};

function TaskList({
  tasks,
  empty,
  show,
}: {
  tasks: TaskLine[];
  empty: string;
  show: "done" | "due" | "blocked";
}) {
  if (!tasks.length) return <p className="text-muted py-3 text-sm">{empty}</p>;
  return (
    <ul className="divide-y">
      {tasks.map((t) => (
        <li key={t.id} className="flex items-start justify-between gap-3 py-2 text-sm">
          <div className="min-w-0">
            <Link href={`/tasks/${t.id}`} className="block truncate font-medium hover:underline">
              {t.title}
            </Link>
            <p className="text-muted text-xs">
              {t.project.name} · {t.assignee ? displayName(t.assignee) : "Unassigned"}
            </p>
            {show === "blocked" && t.blockedReason && (
              <p className="text-danger mt-0.5 text-xs">{t.blockedReason}</p>
            )}
          </div>
          <div className="shrink-0 text-right text-xs">
            <PriorityLabel priority={t.priority} />
            <p className="text-muted">
              {show === "done" ? formatDate(t.completedAt) : t.dueDate ? `Due ${formatDate(t.dueDate)}` : ""}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; date?: string; project?: string }>;
}) {
  const user = await requireUser();
  const p = await searchParams;
  const period: ReportPeriod = p.period === "weekly" ? "weekly" : "daily";
  const day = parseDay(p.date);
  const projects = await listProjects(user);
  const projectId = projects.some((pr) => pr.id === p.project) ? p.project : undefined;
  const report = await getReport(user, { period, day, projectId });

  const step = period === "daily" ? DAY : 7 * DAY;
  const href = (over: Record<string, string | undefined>) => {
    const q = new URLSearchParams();
    const merged = { period, date: toDayString(day), project: projectId, ...over };
    for (const [k, v] of Object.entries(merged)) if (v) q.set(k, v);
    return `/reports?${q.toString()}`;
  };
  const last = new Date(report.end.getTime() - DAY);
  const label =
    period === "daily" ? formatDate(report.start) : `${formatDate(report.start)} to ${formatDate(last)}`;
  const scope = projectId
    ? (projects.find((pr) => pr.id === projectId)?.name ?? "Project")
    : "All your projects";
  const isFuture = report.start.getTime() + step > Date.now() + DAY;

  const stats = [
    { label: "Tasks done", value: report.summary.completed },
    { label: "Estimated hours done", value: report.summary.completedHours },
    { label: "Tasks created", value: report.summary.created },
    { label: "Moved to in progress", value: report.summary.started },
    { label: "Blocked now", value: report.summary.blocked, danger: report.summary.blocked > 0 },
    { label: "Overdue now", value: report.summary.overdue, danger: report.summary.overdue > 0 },
  ];

  return (
    <>
      <PageHeader
        title={`${period === "daily" ? "Daily" : "Weekly"} report`}
        description={`${label} (UTC) · ${scope}`}
        actions={<ReportActions markdown={reportToMarkdown(report, scope)} />}
      />

      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between print:hidden">
        <div className="flex rounded-md border text-sm" role="group" aria-label="Report period">
          <Link
            href={href({ period: "daily" })}
            className={cn(
              "rounded-l-md px-3 py-1.5",
              period === "daily" ? "bg-surface-muted font-medium" : "text-muted",
            )}
          >
            Daily
          </Link>
          <Link
            href={href({ period: "weekly" })}
            className={cn(
              "rounded-r-md px-3 py-1.5",
              period === "weekly" ? "bg-surface-muted font-medium" : "text-muted",
            )}
          >
            Weekly
          </Link>
        </div>
        <form className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="period" value={period} />
          <Button asChild size="icon" variant="ghost" aria-label="Previous period">
            <Link href={href({ date: toDayString(new Date(day.getTime() - step)) })}>
              <ChevronLeft />
            </Link>
          </Button>
          <Input
            type="date"
            name="date"
            defaultValue={toDayString(day)}
            className="h-8 w-40"
            aria-label="Report date"
          />
          <Button
            asChild
            size="icon"
            variant="ghost"
            aria-label="Next period"
            className={isFuture ? "pointer-events-none opacity-40" : ""}
          >
            <Link href={href({ date: toDayString(new Date(day.getTime() + step)) })} aria-disabled={isFuture}>
              <ChevronRight />
            </Link>
          </Button>
          <Select name="project" defaultValue={projectId ?? ""} className="h-8 w-48" aria-label="Project">
            <option value="">All projects</option>
            {projects.map((pr) => (
              <option key={pr.id} value={pr.id}>
                {pr.name}
              </option>
            ))}
          </Select>
          <Button type="submit" size="sm" variant="secondary">
            Show
          </Button>
        </form>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent>
              <p className="text-muted text-xs">{s.label}</p>
              <p className={cn("mt-1 text-2xl font-semibold tabular-nums", s.danger && "text-danger")}>
                {s.value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Done {period === "daily" ? "today" : "this week"}</CardTitle>
          </CardHeader>
          <CardContent className="py-1">
            <TaskList tasks={report.completed} show="done" empty="Nothing completed in this period." />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Blocked now</CardTitle>
          </CardHeader>
          <CardContent className="py-1">
            <TaskList tasks={report.blocked} show="blocked" empty="Nothing is blocked." />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Overdue now</CardTitle>
          </CardHeader>
          <CardContent className="py-1">
            <TaskList tasks={report.overdue} show="due" empty="Nothing overdue." />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Due in the next {period === "daily" ? "day" : "week"}</CardTitle>
          </CardHeader>
          <CardContent className="py-1">
            <TaskList tasks={report.dueNext} show="due" empty="Nothing due soon." />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Projects</CardTitle>
          </CardHeader>
          <CardContent className="py-1">
            {report.projects.length ? (
              <ul className="divide-y">
                {report.projects.map((pr) => (
                  <li key={pr.id} className="py-2.5 text-sm">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <Link
                        href={`/projects/${pr.slug}/tasks`}
                        className="truncate font-medium hover:underline"
                      >
                        {pr.name}
                      </Link>
                      <span className="text-muted shrink-0 text-xs">
                        {pr.done}/{pr.total} done · +{pr.completedInPeriod} this{" "}
                        {period === "daily" ? "day" : "week"}
                        {pr.blocked > 0 && <span className="text-danger"> · {pr.blocked} blocked</span>}
                      </span>
                    </div>
                    <div
                      className="bg-surface-muted h-1.5 overflow-hidden rounded-full"
                      role="img"
                      aria-label={`${Math.round(pr.progress * 100)}% of tasks done`}
                    >
                      <div className="bg-success h-full" style={{ width: `${pr.progress * 100}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted py-3 text-sm">No projects with tasks yet.</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Who finished what</CardTitle>
          </CardHeader>
          <CardContent className="py-1">
            {report.people.length ? (
              <table className="w-full text-sm">
                <thead className="text-muted text-left text-xs">
                  <tr>
                    <th className="py-2 font-medium">Person</th>
                    <th className="py-2 text-right font-medium">Tasks</th>
                    <th className="py-2 text-right font-medium">Est. hours</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {report.people.map((person) => (
                    <tr key={person.id}>
                      <td className="py-2">
                        <Link href={`/team/${person.id}`} className="hover:underline">
                          {person.name}
                        </Link>
                      </td>
                      <td className="py-2 text-right tabular-nums">{person.tasks}</td>
                      <td className="py-2 text-right tabular-nums">{person.hours}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-muted py-3 text-sm">No assigned tasks were completed.</p>
            )}
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Activity ({report.activity.length})</CardTitle>
          </CardHeader>
          <CardContent className="py-1">
            {report.activity.length ? (
              <ul className="divide-y">
                {report.activity.map((a) => (
                  <li key={a.id} className="flex justify-between gap-3 py-2 text-sm">
                    <p className="min-w-0">
                      <span className="font-medium">{a.actor ? displayName(a.actor) : "Someone"}</span>{" "}
                      <span className="text-muted">{a.summary}</span>
                    </p>
                    <span className="text-muted shrink-0 text-xs">
                      <RelativeTime date={a.createdAt} />
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted py-3 text-sm">No activity in this period.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
