import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/session";
import { orNotFound } from "@/lib/errors";
import { getBreakdown } from "@/features/ai/service";
import { BreakdownEditor } from "@/features/ai/components/breakdown-editor";
import { BreakdownStatusBadge } from "@/features/ai/components/status-badge";
import { PageHeader } from "@/components/shared/page-header";
import { RelativeTime } from "@/components/shared/relative-time";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Review AI draft" };

export default async function BreakdownPage({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const user = await requireUser();
  const { slug, id } = await params;
  const { breakdown, project } = await orNotFound(getBreakdown(user, id));
  if (project.slug !== slug) notFound();
  const readOnly = breakdown.status !== "DRAFT";

  return (
    <>
      <Link
        href={`/projects/${project.slug}/breakdown`}
        className="text-muted hover:text-foreground mb-3 inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" aria-hidden /> AI task breakdown
      </Link>
      <PageHeader
        title={readOnly ? "AI draft" : "Review AI draft"}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <BreakdownStatusBadge status={breakdown.status} />
            <span>
              {project.name}, drafted <RelativeTime date={breakdown.createdAt} />
            </span>
            {breakdown.status === "APPROVED" && (
              <Link href={`/projects/${project.slug}/tasks`} className="text-primary hover:underline">
                {breakdown.createdTasks} tasks created
              </Link>
            )}
          </span>
        }
      />

      <details className="mb-4">
        <summary className="text-muted hover:text-foreground cursor-pointer text-sm">
          Show the original requirement
        </summary>
        <Card className="mt-2">
          <CardHeader>
            <CardTitle>Requirement</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{breakdown.requirement}</p>
          </CardContent>
        </Card>
      </details>

      <BreakdownEditor
        id={breakdown.id}
        projectSlug={project.slug}
        initial={breakdown.draft}
        members={project.members}
        readOnly={readOnly}
      />
      <p className="text-muted mt-4 text-xs">
        Drafted by {breakdown.model}. AI output can be wrong; check estimates and criteria before approving.
      </p>
    </>
  );
}
