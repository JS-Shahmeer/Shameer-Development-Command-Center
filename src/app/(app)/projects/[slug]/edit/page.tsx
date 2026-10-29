import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { can } from "@/lib/permissions";
import { orNotFound } from "@/lib/errors";
import { getProjectBySlug } from "@/features/projects/service";
import { listClientOptions } from "@/features/clients/service";
import { listAssignableUsers } from "@/features/users/service";
import { ProjectForm } from "@/features/projects/components/project-form";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = { title: "Edit project" };

export default async function EditProjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const user = await requireUser();
  const { slug } = await params;
  const { project, permissions } = await orNotFound(getProjectBySlug(user, slug));
  if (!permissions.edit) redirect(`/projects/${slug}`);

  const [clients, users] = await Promise.all([listClientOptions(user), listAssignableUsers(user)]);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={`Edit ${project.name}`} />
      <Card>
        <CardContent className="p-5">
          <ProjectForm
            defaults={project}
            clients={clients}
            leads={users.filter((u) => can.beProjectLead(u))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
