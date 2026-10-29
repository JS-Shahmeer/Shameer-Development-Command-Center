import type { Metadata } from "next";
import Link from "next/link";
import { differenceInCalendarDays } from "date-fns";
import { Activity, AlertTriangle, CalendarClock, FolderKanban, Plus } from "lucide-react";
import { requireUser } from "@/lib/session";
import { can } from "@/lib/permissions";
import { displayName } from "@/lib/utils";
import { getDashboard } from "@/features/dashboard/service";
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

function DueList({ projects, overdue }: { projects: DueProject[]; overdue?: boolean }) {
  const today = new Date();
  return (
    <ul className="divide-y">
      {projects.map((p) => {
        const days = p.dueDate ? differenceInCalendarDays(p.dueDate, today) : 0;
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
              <p className={overdue ? "text-danger font-medium" : "text-foreground"}>
                {overdue ? `${Math.abs(days)}d overdue` : days === 0 ? "Due today" : `In ${days}d`}
              </p>
              <p className="text-muted">{formatDate(p.dueDate)}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export default async function DashboardPage() {
  const user = await requireUser();
  const data = await getDashboard(user);
  const totalOpen = data.counts.active + data.counts.planning + data.counts.onHold;

  const stats = [
    { label: "Active projects", value: data.counts.active },
    { label: "In planning", value: data.counts.planning },
    { label: "On hold", value: data.counts.onHold },
    { label: "Overdue", value: data.overdue.length, danger: data.overdue.length > 0 },
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
          <Card key={s.label}>
            <CardContent>
              <p className="text-muted text-xs">{s.label}</p>
              <p className={`mt-1 text-2xl font-semibold tabular-nums ${s.danger ? "text-danger" : ""}`}>
                {s.value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {totalOpen === 0 && data.counts.completed === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title="No projects yet"
          description={
            can.createProject(user)
              ? "Create your first project to start tracking deadlines and activity."
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
          <div className="space-y-4 lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="text-danger size-4" aria-hidden /> Overdue
                </CardTitle>
              </CardHeader>
              <CardContent className="py-1">
                {data.overdue.length ? (
                  <DueList projects={data.overdue} overdue />
                ) : (
                  <p className="text-muted py-3 text-sm">Nothing overdue.</p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CalendarClock className="text-primary size-4" aria-hidden /> Due in the next 3 weeks
                </CardTitle>
              </CardHeader>
              <CardContent className="py-1">
                {data.upcoming.length ? (
                  <DueList projects={data.upcoming} />
                ) : (
                  <p className="text-muted py-3 text-sm">No upcoming deadlines.</p>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="text-muted size-4" aria-hidden /> Recent activity
              </CardTitle>
            </CardHeader>
            <CardContent className="py-1">
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
                      </p>
                      <span className="text-muted shrink-0 text-xs">
                        <RelativeTime date={a.createdAt} />
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted py-3 text-sm">No activity yet.</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}
