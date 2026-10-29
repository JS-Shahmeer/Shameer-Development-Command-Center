import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  ExternalLink,
  GitBranch,
  Globe,
  Mail,
  Phone,
  TestTube2,
} from "lucide-react";
import { requireUser } from "@/lib/session";
import { can } from "@/lib/permissions";
import { orNotFound } from "@/lib/errors";
import { getProjectBySlug } from "@/features/projects/service";
import { listAssignableUsers } from "@/features/users/service";
import { ProjectStatusBadge } from "@/features/projects/components/status-badge";
import { ProjectActions } from "@/features/projects/components/project-actions";
import { MembersPanel } from "@/features/projects/components/members-panel";
import { NotesPanel } from "@/features/notes/components/notes-panel";
import { PageHeader } from "@/components/shared/page-header";
import { formatDate } from "@/components/shared/relative-time";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  return { title: slug };
}

function LinkRow({ icon: Icon, label, href }: { icon: typeof Globe; label: string; href: string | null }) {
  return (
    <div className="flex items-center gap-3 py-2 text-sm">
      <Icon className="text-muted size-4 shrink-0" aria-hidden />
      <span className="text-muted w-24 shrink-0">{label}</span>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="text-primary flex min-w-0 items-center gap-1 truncate hover:underline"
        >
          <span className="truncate">{href.replace(/^https?:\/\//, "")}</span>
          <ExternalLink className="size-3 shrink-0" aria-hidden />
        </a>
      ) : (
        <span className="text-muted">Not set</span>
      )}
    </div>
  );
}

export default async function ProjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const user = await requireUser();
  const { slug } = await params;
  const { project, permissions } = await orNotFound(getProjectBySlug(user, slug));
  const candidates = permissions.manageMembers ? await listAssignableUsers(user) : [];
  const notes = project.notes.map((n) => ({ ...n, canEdit: can.editNote(user, project, n) }));

  return (
    <>
      <Link
        href="/projects"
        className="text-muted hover:text-foreground mb-3 inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" aria-hidden /> Projects
      </Link>
      <PageHeader
        title={project.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <ProjectStatusBadge status={project.status} />
            {project.archivedAt && <Badge tone="warning">Archived</Badge>}
            <span>{project.client?.name ?? "No client"}</span>
          </span>
        }
        actions={
          permissions.edit && (
            <ProjectActions
              id={project.id}
              slug={project.slug}
              name={project.name}
              archived={Boolean(project.archivedAt)}
            />
          )
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Overview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {project.description ? (
                <p className="text-sm whitespace-pre-wrap">{project.description}</p>
              ) : (
                <p className="text-muted text-sm">No description yet.</p>
              )}
              <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
                <span className="text-muted flex items-center gap-1.5">
                  <CalendarDays className="size-4" aria-hidden /> Start{" "}
                  <span className="text-foreground">{formatDate(project.startDate)}</span>
                </span>
                <span className="text-muted flex items-center gap-1.5">
                  <CalendarDays className="size-4" aria-hidden /> Due{" "}
                  <span className="text-foreground">{formatDate(project.dueDate)}</span>
                </span>
              </div>
              {project.technologies.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {project.technologies.map((t) => (
                    <Badge key={t} className="font-mono text-[11px]">
                      {t}
                    </Badge>
                  ))}
                </div>
              )}
              <div className="divide-y border-t">
                <LinkRow icon={GitBranch} label="Repository" href={project.repoUrl} />
                <LinkRow icon={TestTube2} label="Staging" href={project.stagingUrl} />
                <LinkRow icon={Globe} label="Production" href={project.productionUrl} />
              </div>
            </CardContent>
          </Card>

          <NotesPanel projectId={project.id} notes={notes} canCreate={permissions.createNote} />
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="text-muted size-4" aria-hidden /> Client
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {project.client ? (
                <>
                  <p className="font-medium">{project.client.name}</p>
                  {project.client.company && <p className="text-muted">{project.client.company}</p>}
                  {project.client.contactName && <p>{project.client.contactName}</p>}
                  {project.client.email && (
                    <a
                      href={`mailto:${project.client.email}`}
                      className="text-primary flex items-center gap-2 hover:underline"
                    >
                      <Mail className="size-4" aria-hidden /> {project.client.email}
                    </a>
                  )}
                  {project.client.phone && (
                    <a
                      href={`tel:${project.client.phone}`}
                      className="flex items-center gap-2 hover:underline"
                    >
                      <Phone className="text-muted size-4" aria-hidden /> {project.client.phone}
                    </a>
                  )}
                </>
              ) : (
                <p className="text-muted">No client linked.</p>
              )}
            </CardContent>
          </Card>

          <MembersPanel
            projectId={project.id}
            leadId={project.leadId}
            members={project.members}
            candidates={candidates}
            canManage={permissions.manageMembers}
          />
        </div>
      </div>
    </>
  );
}
