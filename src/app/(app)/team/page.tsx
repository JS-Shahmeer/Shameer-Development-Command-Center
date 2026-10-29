import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Users } from "lucide-react";
import { requireUser } from "@/lib/session";
import { can } from "@/lib/permissions";
import { displayName } from "@/lib/utils";
import { listTeam } from "@/features/team/service";
import { WorkloadBar } from "@/features/team/components/workload-bar";
import { roleLabel } from "@/features/users/schemas";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Team" };

export default async function TeamPage({ searchParams }: { searchParams: Promise<{ sort?: string }> }) {
  const user = await requireUser();
  if (!can.viewTeam(user)) redirect(`/team/${user.id}`);
  const sort = (await searchParams).sort === "name" ? "name" : "load";
  const team = await listTeam(user);
  if (sort === "load") team.sort((a, b) => b.workload.load - a.workload.load);

  return (
    <>
      <PageHeader
        title="Team"
        description={
          user.role === "ADMIN"
            ? "Everyone in the workspace."
            : "People on the projects you lead or belong to."
        }
        actions={
          <div className="flex rounded-md border text-sm" role="group" aria-label="Sort">
            <Link
              href="/team"
              className={`rounded-l-md px-3 py-1.5 ${sort === "load" ? "bg-surface-muted font-medium" : "text-muted"}`}
            >
              Busiest first
            </Link>
            <Link
              href="/team?sort=name"
              className={`rounded-r-md px-3 py-1.5 ${sort === "name" ? "bg-surface-muted font-medium" : "text-muted"}`}
            >
              A to Z
            </Link>
          </div>
        }
      />
      {team.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No teammates yet"
          description="People appear here once they're on one of your projects."
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {team.map((m) => (
            <li key={m.id}>
              <Link
                href={`/team/${m.id}`}
                className="bg-surface hover:border-primary/40 flex h-full flex-col rounded-lg border p-4 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Avatar user={m} className="size-9" />
                  <div className="min-w-0">
                    <p className="truncate font-medium">{displayName(m)}</p>
                    <p className="text-muted truncate text-xs">{m.title ?? roleLabel[m.role]}</p>
                  </div>
                </div>
                {m.skills.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {m.skills.slice(0, 4).map((s) => (
                      <Badge key={s.skill.name} className="text-[11px]">
                        {s.skill.name}
                      </Badge>
                    ))}
                    {m.skills.length > 4 && <Badge className="text-[11px]">+{m.skills.length - 4}</Badge>}
                  </div>
                )}
                <div className="mt-auto pt-4">
                  <p className="text-muted mb-2 flex gap-3 text-xs">
                    <span>{m.workload.openTasks} open</span>
                    {m.workload.overdue > 0 && (
                      <span className="text-danger">{m.workload.overdue} overdue</span>
                    )}
                    {m.workload.blocked > 0 && (
                      <span className="text-danger">{m.workload.blocked} blocked</span>
                    )}
                    <span>{m._count.memberships} projects</span>
                  </p>
                  <WorkloadBar workload={m.workload} />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
