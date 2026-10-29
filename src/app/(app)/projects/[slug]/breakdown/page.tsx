import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, KeyRound, Sparkles } from "lucide-react";
import { requireUser } from "@/lib/session";
import { can } from "@/lib/permissions";
import { orNotFound } from "@/lib/errors";
import { getProjectBySlug } from "@/features/projects/service";
import { listBreakdowns } from "@/features/ai/service";
import { isAiConfigured } from "@/features/ai/claude";
import { RequirementForm } from "@/features/ai/components/requirement-form";
import { BreakdownStatusBadge } from "@/features/ai/components/status-badge";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { RelativeTime } from "@/components/shared/relative-time";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "AI task breakdown" };
// Generation runs inside the Server Action on this route and can take close to a minute.
export const maxDuration = 120;

export default async function BreakdownListPage({ params }: { params: Promise<{ slug: string }> }) {
  const user = await requireUser();
  const { slug } = await params;
  const { project } = await orNotFound(getProjectBySlug(user, slug));
  if (!can.manageTasks(user, project)) notFound();
  const breakdowns = await listBreakdowns(user, project.id);
  const configured = isAiConfigured();

  return (
    <>
      <Link
        href={`/projects/${project.slug}`}
        className="text-muted hover:text-foreground mb-3 inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" aria-hidden /> {project.name}
      </Link>
      <PageHeader
        title="AI task breakdown"
        description="Turn a client requirement into a draft task list. You review and edit every task before anything is created."
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="text-muted size-4" aria-hidden /> New breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            {project.archivedAt ? (
              <p className="text-muted text-sm">This project is archived. Restore it to add tasks.</p>
            ) : configured ? (
              <RequirementForm projectId={project.id} projectSlug={project.slug} />
            ) : (
              <EmptyState
                icon={KeyRound}
                title="AI isn't set up yet"
                description="An admin needs to add ANTHROPIC_API_KEY to the server environment (on Vercel: Project Settings, Environment Variables) and redeploy."
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>History</CardTitle>
          </CardHeader>
          <CardContent>
            {breakdowns.length ? (
              <ul className="divide-y">
                {breakdowns.map((b) => (
                  <li key={b.id}>
                    <Link
                      href={`/projects/${project.slug}/breakdown/${b.id}`}
                      className="hover:bg-surface-muted -mx-2 block rounded-md px-2 py-2.5"
                    >
                      <p className="line-clamp-2 text-sm">{b.requirement}</p>
                      <div className="text-muted mt-1 flex flex-wrap items-center gap-2 text-xs">
                        <BreakdownStatusBadge status={b.status} />
                        {b.status === "APPROVED" && <span>{b.createdTasks} tasks created</span>}
                        <span>
                          {b.createdBy?.name ?? b.createdBy?.email ?? "Former user"},{" "}
                          <RelativeTime date={b.createdAt} />
                        </span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted text-sm">No breakdowns yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
