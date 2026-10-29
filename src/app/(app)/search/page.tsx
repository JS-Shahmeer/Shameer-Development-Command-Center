import type { Metadata } from "next";
import Link from "next/link";
import { Building2, FolderKanban, ListTodo, NotebookPen, SearchX, Users } from "lucide-react";
import { requireUser } from "@/lib/session";
import { displayName } from "@/lib/utils";
import { globalSearch, MIN_QUERY_LENGTH } from "@/features/search/service";
import { TaskStatusBadge } from "@/features/tasks/components/badges";
import { ProjectStatusBadge } from "@/features/projects/components/status-badge";
import { roleLabel } from "@/features/users/schemas";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Search" };

/** Wraps case-insensitive matches of `q` in <mark>. */
function Highlight({ text, q }: { text: string; q: string }) {
  const parts = text.split(new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "ig"));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === q.toLowerCase() ? (
          <mark key={i} className="bg-warning/30 text-foreground rounded-sm px-0.5">
            {part}
          </mark>
        ) : (
          part
        ),
      )}
    </>
  );
}

function Group({
  icon: Icon,
  title,
  count,
  children,
}: {
  icon: typeof Users;
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  if (!count) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon className="text-muted size-4" aria-hidden /> {title} ({count})
        </CardTitle>
      </CardHeader>
      <CardContent className="py-1">
        <ul className="divide-y">{children}</ul>
      </CardContent>
    </Card>
  );
}

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await requireUser();
  const q = (await searchParams).q ?? "";
  const results = await globalSearch(user, q);

  if (!results) {
    return (
      <>
        <PageHeader title="Search" />
        <EmptyState
          icon={SearchX}
          title={q ? `Type at least ${MIN_QUERY_LENGTH} characters` : "Search everything"}
          description="Find projects, tasks, notes, clients and people. Press Ctrl K or / from any page."
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={`Results for "${results.q}"`}
        description={`${results.total} matches you have access to.`}
      />
      {results.total === 0 ? (
        <EmptyState icon={SearchX} title="No matches" description="Try a shorter or different word." />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Group icon={ListTodo} title="Tasks" count={results.tasks.length}>
            {results.tasks.map((t) => (
              <li key={t.id} className="py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <Link href={`/tasks/${t.id}`} className="truncate text-sm font-medium hover:underline">
                    <Highlight text={t.title} q={results.q} />
                  </Link>
                  <TaskStatusBadge status={t.status} />
                </div>
                <p className="text-muted text-xs">{t.project.name}</p>
                {t.snippet && (
                  <p className="text-muted mt-1 text-xs">
                    <Highlight text={t.snippet} q={results.q} />
                  </p>
                )}
              </li>
            ))}
          </Group>
          <Group icon={FolderKanban} title="Projects" count={results.projects.length}>
            {results.projects.map((p) => (
              <li key={p.id} className="py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <Link href={`/projects/${p.slug}`} className="truncate text-sm font-medium hover:underline">
                    <Highlight text={p.name} q={results.q} />
                  </Link>
                  <span className="flex gap-1">
                    {p.archivedAt && <Badge tone="warning">Archived</Badge>}
                    <ProjectStatusBadge status={p.status} />
                  </span>
                </div>
                <p className="text-muted text-xs">{p.client?.name ?? "No client"}</p>
                {p.snippet && (
                  <p className="text-muted mt-1 text-xs">
                    <Highlight text={p.snippet} q={results.q} />
                  </p>
                )}
              </li>
            ))}
          </Group>
          <Group icon={NotebookPen} title="Notes" count={results.notes.length}>
            {results.notes.map((n) => (
              <li key={n.id} className="py-2.5">
                <Link
                  href={`/projects/${n.project.slug}`}
                  className="block truncate text-sm font-medium hover:underline"
                >
                  <Highlight text={n.title} q={results.q} />
                </Link>
                <p className="text-muted text-xs">{n.project.name}</p>
                {n.snippet && (
                  <p className="text-muted mt-1 text-xs">
                    <Highlight text={n.snippet} q={results.q} />
                  </p>
                )}
              </li>
            ))}
          </Group>
          <Group icon={Users} title="People" count={results.people.length}>
            {results.people.map((p) => (
              <li key={p.id} className="flex items-center gap-3 py-2.5">
                <Avatar user={p} />
                <div className="min-w-0">
                  <Link href={`/team/${p.id}`} className="block truncate text-sm font-medium hover:underline">
                    <Highlight text={displayName(p)} q={results.q} />
                  </Link>
                  <p className="text-muted truncate text-xs">{p.title ?? roleLabel[p.role]}</p>
                </div>
              </li>
            ))}
          </Group>
          <Group icon={Building2} title="Clients" count={results.clients.length}>
            {results.clients.map((c) => (
              <li key={c.id} className="py-2.5">
                <Link
                  href={`/clients?q=${encodeURIComponent(c.name)}`}
                  className="block truncate text-sm font-medium hover:underline"
                >
                  <Highlight text={c.name} q={results.q} />
                </Link>
                <p className="text-muted text-xs">
                  {[c.company, c.contactName].filter(Boolean).join(" · ") || "No contact details"}
                </p>
              </li>
            ))}
          </Group>
        </div>
      )}
    </>
  );
}
