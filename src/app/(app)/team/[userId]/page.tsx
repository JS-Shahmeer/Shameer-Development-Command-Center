import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Briefcase, CheckCircle2, ListTodo } from "lucide-react";
import { requireUser } from "@/lib/session";
import { can } from "@/lib/permissions";
import { orNotFound } from "@/lib/errors";
import { displayName } from "@/lib/utils";
import { getMember, listSkillNames } from "@/features/team/service";
import { SKILL_LEVELS } from "@/features/team/schemas";
import { WorkloadBar } from "@/features/team/components/workload-bar";
import { ProfileDialog } from "@/features/team/components/profile-dialog";
import { PriorityLabel, TaskStatusBadge } from "@/features/tasks/components/badges";
import { ProjectStatusBadge } from "@/features/projects/components/status-badge";
import { roleLabel } from "@/features/users/schemas";
import { formatDate } from "@/components/shared/relative-time";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Profile" };

export default async function MemberPage({ params }: { params: Promise<{ userId: string }> }) {
  const viewer = await requireUser();
  const { userId } = await params;
  const { user, workload, openTasks, recentlyDone, permissions } = await orNotFound(
    getMember(viewer, userId),
  );
  const knownSkills = permissions.edit ? (await listSkillNames()).map((s) => s.name) : [];
  const now = new Date();

  return (
    <>
      {can.viewTeam(viewer) && (
        <Link
          href="/team"
          className="text-muted hover:text-foreground mb-3 inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft className="size-4" aria-hidden /> Team
        </Link>
      )}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Avatar user={user} className="size-14 text-base" />
          <div>
            <h1 className="text-xl font-semibold tracking-tight">{displayName(user)}</h1>
            <p className="text-muted text-sm">
              {user.title ?? roleLabel[user.role]} · {user.email}
            </p>
            {!user.isActive && (
              <Badge tone="warning" className="mt-1">
                Deactivated
              </Badge>
            )}
          </div>
        </div>
        {permissions.edit && (
          <ProfileDialog
            user={{
              id: user.id,
              name: user.name,
              title: user.title,
              bio: user.bio,
              capacityHours: user.capacityHours,
              skills: user.skills.map((s) => ({ name: s.skill.name, level: s.level })),
            }}
            canSetCapacity={permissions.setCapacity}
            knownSkills={knownSkills}
          />
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ListTodo className="text-muted size-4" aria-hidden /> Open tasks ({openTasks.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="py-1">
              {openTasks.length ? (
                <ul className="divide-y">
                  {openTasks.map((t) => (
                    <li key={t.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-sm">
                      <div className="min-w-0 flex-1">
                        <Link href={`/tasks/${t.id}`} className="block truncate font-medium hover:underline">
                          {t.title}
                        </Link>
                        <p className="text-muted text-xs">{t.project.name}</p>
                      </div>
                      <PriorityLabel priority={t.priority} />
                      <TaskStatusBadge status={t.status} />
                      <span
                        className={`w-24 text-right text-xs ${t.dueDate && t.dueDate < now ? "text-danger font-medium" : "text-muted"}`}
                      >
                        {t.dueDate ? formatDate(t.dueDate) : "No due date"}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted py-3 text-sm">No open tasks.</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="text-success size-4" aria-hidden /> Done in the last 14 days (
                {recentlyDone.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="py-1">
              {recentlyDone.length ? (
                <ul className="divide-y">
                  {recentlyDone.map((t) => (
                    <li key={t.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                      <Link href={`/tasks/${t.id}`} className="min-w-0 truncate hover:underline">
                        {t.title} <span className="text-muted text-xs">· {t.project.name}</span>
                      </Link>
                      <span className="text-muted shrink-0 text-xs">{formatDate(t.completedAt)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted py-3 text-sm">Nothing completed recently.</p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Workload</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <WorkloadBar workload={workload} />
              <dl className="grid grid-cols-3 gap-2 text-center text-sm">
                <div>
                  <dt className="text-muted text-xs">Open</dt>
                  <dd className="font-semibold tabular-nums">{workload.openTasks}</dd>
                </div>
                <div>
                  <dt className="text-muted text-xs">Overdue</dt>
                  <dd className={`font-semibold tabular-nums ${workload.overdue ? "text-danger" : ""}`}>
                    {workload.overdue}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted text-xs">Blocked</dt>
                  <dd className={`font-semibold tabular-nums ${workload.blocked ? "text-danger" : ""}`}>
                    {workload.blocked}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Skills</CardTitle>
            </CardHeader>
            <CardContent>
              {user.skills.length ? (
                <ul className="space-y-2">
                  {user.skills.map((s) => (
                    <li key={s.skill.id} className="flex items-center justify-between gap-2 text-sm">
                      <span>{s.skill.name}</span>
                      <span className="text-muted flex items-center gap-2 text-xs">
                        {SKILL_LEVELS[s.level]}
                        <span className="flex gap-0.5" aria-label={`Level ${s.level} of 5`}>
                          {[1, 2, 3, 4, 5].map((n) => (
                            <span
                              key={n}
                              className={`size-1.5 rounded-full ${n <= s.level ? "bg-primary" : "bg-surface-muted"}`}
                            />
                          ))}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted text-sm">No skills listed.</p>
              )}
              {user.bio && <p className="mt-4 border-t pt-3 text-sm whitespace-pre-wrap">{user.bio}</p>}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Briefcase className="text-muted size-4" aria-hidden /> Projects
              </CardTitle>
            </CardHeader>
            <CardContent className="py-1">
              {user.memberships.length ? (
                <ul className="divide-y">
                  {user.memberships.map((m) => (
                    <li key={m.project.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                      <Link href={`/projects/${m.project.slug}`} className="truncate hover:underline">
                        {m.project.name}
                      </Link>
                      <span className="flex items-center gap-2">
                        {m.role === "LEAD" && <Badge tone="primary">Lead</Badge>}
                        <ProjectStatusBadge status={m.project.status} />
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted py-3 text-sm">Not on any projects.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
