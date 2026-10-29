import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/session";
import { can } from "@/lib/permissions";
import { orNotFound } from "@/lib/errors";
import { getProjectBySlug } from "@/features/projects/service";
import { listProjectTasks } from "@/features/tasks/service";
import { TaskBoard } from "@/features/tasks/components/task-board";
import { toCardData } from "@/features/tasks/components/to-card";
import { PageHeader } from "@/components/shared/page-header";

export const metadata: Metadata = { title: "Tasks" };

export default async function ProjectTasksPage({ params }: { params: Promise<{ slug: string }> }) {
  const user = await requireUser();
  const { slug } = await params;
  const { project } = await orNotFound(getProjectBySlug(user, slug));
  const tasks = await listProjectTasks(user, project.id);
  const open = tasks.filter((t) => t.status !== "DONE").length;

  return (
    <>
      <Link
        href={`/projects/${project.slug}`}
        className="text-muted hover:text-foreground mb-3 inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" aria-hidden /> {project.name}
      </Link>
      <PageHeader title="Tasks" description={`${open} open, ${tasks.length - open} done`} />
      <TaskBoard
        projectId={project.id}
        tasks={tasks.map((t) => toCardData(t, user, project))}
        assignees={project.members.map((m) => ({ id: m.user.id, name: m.user.name, email: m.user.email }))}
        currentUserId={user.id}
        canCreate={can.createTask(user, project) && !project.archivedAt}
        canAssignOthers={can.manageTasks(user, project)}
      />
    </>
  );
}
