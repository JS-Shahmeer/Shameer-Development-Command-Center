import type { Metadata } from "next";
import Link from "next/link";
import { Archive, ExternalLink, FolderKanban, GitBranch, Plus, Search } from "lucide-react";
import { requireUser } from "@/lib/session";
import { can } from "@/lib/permissions";
import { displayName } from "@/lib/utils";
import { listProjects } from "@/features/projects/service";
import { PROJECT_STATUSES, projectStatusLabel } from "@/features/projects/schemas";
import { ProjectStatusBadge } from "@/features/projects/components/status-badge";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { formatDate } from "@/components/shared/relative-time";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";

export const metadata: Metadata = { title: "Projects" };

type Search = { q?: string; status?: string; archived?: string };

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const user = await requireUser();
  const params = await searchParams;
  const status = PROJECT_STATUSES.find((s) => s === params.status);
  const archived = params.archived === "1";
  const q = params.q?.trim() || undefined;
  const projects = await listProjects(user, { q, status, archived });
  const filtered = Boolean(q || status);

  return (
    <>
      <PageHeader
        title={archived ? "Archived projects" : "Projects"}
        description={
          archived
            ? "Archived projects are hidden from the dashboard."
            : "Every client project you can access."
        }
        actions={
          <>
            <Button asChild variant="secondary">
              <Link href={archived ? "/projects" : "/projects?archived=1"}>
                <Archive /> {archived ? "View active" : "View archived"}
              </Link>
            </Button>
            {can.createProject(user) && (
              <Button asChild>
                <Link href="/projects/new">
                  <Plus /> New project
                </Link>
              </Button>
            )}
          </>
        }
      />

      <form className="mb-4 flex flex-col gap-2 sm:flex-row" role="search">
        {archived && <input type="hidden" name="archived" value="1" />}
        <div className="relative flex-1">
          <Search
            className="text-muted pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2"
            aria-hidden
          />
          <Input
            name="q"
            defaultValue={q}
            placeholder="Search by name, client or technology"
            className="pl-8"
            aria-label="Search projects"
          />
        </div>
        <Select name="status" defaultValue={status ?? ""} className="sm:w-44" aria-label="Filter by status">
          <option value="">All statuses</option>
          {PROJECT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {projectStatusLabel[s]}
            </option>
          ))}
        </Select>
        <Button type="submit" variant="secondary">
          Filter
        </Button>
      </form>

      {projects.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title={
            filtered
              ? "No projects match your filters"
              : archived
                ? "No archived projects"
                : "No projects yet"
          }
          description={
            filtered
              ? "Try a different search or status."
              : archived
                ? undefined
                : can.createProject(user)
                  ? "Create a project to track its client, links, team and notes."
                  : "You'll see projects here once a lead adds you to one."
          }
          action={
            filtered ? (
              <Button asChild variant="secondary">
                <Link href={archived ? "/projects?archived=1" : "/projects"}>Clear filters</Link>
              </Button>
            ) : (
              !archived &&
              can.createProject(user) && (
                <Button asChild>
                  <Link href="/projects/new">
                    <Plus /> New project
                  </Link>
                </Button>
              )
            )
          }
        />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {projects.map((p) => (
            <li
              key={p.id}
              className="bg-surface hover:border-primary/40 flex flex-col rounded-lg border p-4 transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <Link href={`/projects/${p.slug}`} className="block truncate font-medium hover:underline">
                    {p.name}
                  </Link>
                  <p className="text-muted truncate text-xs">{p.client?.name ?? "No client"}</p>
                </div>
                <ProjectStatusBadge status={p.status} />
              </div>
              {p.technologies.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1">
                  {p.technologies.slice(0, 5).map((t) => (
                    <Badge key={t} className="font-mono text-[11px]">
                      {t}
                    </Badge>
                  ))}
                  {p.technologies.length > 5 && <Badge>+{p.technologies.length - 5}</Badge>}
                </div>
              )}
              <div className="text-muted mt-auto flex items-center justify-between gap-2 pt-4 text-xs">
                <span className="flex items-center gap-1.5">
                  {p.lead ? (
                    <>
                      <Avatar user={p.lead} className="size-5 text-[9px]" /> {displayName(p.lead)}
                    </>
                  ) : (
                    "No lead"
                  )}
                  <span aria-hidden>·</span> {p._count.members}{" "}
                  {p._count.members === 1 ? "member" : "members"}
                </span>
                <span className="flex items-center gap-2">
                  {p.repoUrl && (
                    <a
                      href={p.repoUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="hover:text-foreground"
                      aria-label={`${p.name} repository`}
                    >
                      <GitBranch className="size-3.5" />
                    </a>
                  )}
                  {p.productionUrl && (
                    <a
                      href={p.productionUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="hover:text-foreground"
                      aria-label={`${p.name} production site`}
                    >
                      <ExternalLink className="size-3.5" />
                    </a>
                  )}
                  <span>Due {formatDate(p.dueDate)}</span>
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
