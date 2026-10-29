import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { can } from "@/lib/permissions";
import { listClientOptions } from "@/features/clients/service";
import { listAssignableUsers } from "@/features/users/service";
import { ProjectForm } from "@/features/projects/components/project-form";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = { title: "New project" };

export default async function NewProjectPage() {
  const user = await requireUser();
  if (!can.createProject(user)) redirect("/projects");
  const [clients, users] = await Promise.all([listClientOptions(user), listAssignableUsers(user)]);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="New project"
        description="Add the client, links and stack. You can add team members next."
      />
      <Card>
        <CardContent className="p-5">
          <ProjectForm clients={clients} leads={users.filter((u) => can.beProjectLead(u))} />
        </CardContent>
      </Card>
    </div>
  );
}
