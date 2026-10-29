"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ProjectStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { FormField } from "@/components/shared/form-field";
import { useServerAction } from "@/hooks/use-server-action";
import { roleLabel } from "@/features/users/schemas";
import { createProjectAction, updateProjectAction } from "../actions";
import { PROJECT_STATUSES, projectStatusLabel, type ProjectFormValues } from "../schemas";

export type ProjectFormDefaults = {
  id?: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  clientId: string | null;
  leadId: string | null;
  startDate: Date | null;
  dueDate: Date | null;
  repoUrl: string | null;
  stagingUrl: string | null;
  productionUrl: string | null;
  technologies: string[];
};

const toDateInput = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

export function ProjectForm({
  defaults,
  clients,
  leads,
}: {
  defaults?: ProjectFormDefaults;
  clients: { id: string; name: string }[];
  leads: { id: string; name: string | null; email: string; role: "ADMIN" | "LEAD" | "DEVELOPER" }[];
}) {
  const router = useRouter();
  const editing = Boolean(defaults?.id);
  const create = useServerAction(createProjectAction);
  const update = useServerAction(updateProjectAction);
  const { pending, fieldErrors } = editing ? update : create;
  const [techText, setTechText] = useState(defaults?.technologies.join(", ") ?? "");

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const get = (k: string) => String(form.get(k) ?? "");
    const values: ProjectFormValues = {
      name: get("name"),
      description: get("description"),
      status: get("status") as ProjectStatus,
      clientId: get("clientId"),
      leadId: get("leadId"),
      startDate: get("startDate"),
      dueDate: get("dueDate"),
      repoUrl: get("repoUrl"),
      stagingUrl: get("stagingUrl"),
      productionUrl: get("productionUrl"),
      technologies: techText
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    };

    const result =
      editing && defaults?.id
        ? await update.run({ id: defaults.id, data: values }, { success: "Project updated" })
        : await create.run(values, { success: "Project created" });
    if (result) {
      router.push(`/projects/${result.data.slug}`);
      router.refresh();
    }
  }

  const err = (k: string) => fieldErrors[k] ?? fieldErrors[`data.${k}`];
  const aria = (k: string) => (err(k) ? { "aria-invalid": true, "aria-describedby": `${k}-error` } : {});

  return (
    <form onSubmit={onSubmit} className="space-y-6" noValidate>
      <section className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <FormField id="name" label="Project name" required error={err("name")}>
            <Input
              id="name"
              name="name"
              defaultValue={defaults?.name}
              maxLength={120}
              required
              autoFocus
              {...aria("name")}
            />
          </FormField>
        </div>
        <FormField id="status" label="Status" error={err("status")}>
          <Select id="status" name="status" defaultValue={defaults?.status ?? "PLANNING"}>
            {PROJECT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {projectStatusLabel[s]}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField
          id="clientId"
          label="Client"
          error={err("clientId")}
          hint={clients.length ? undefined : "Add clients on the Clients page."}
        >
          <Select id="clientId" name="clientId" defaultValue={defaults?.clientId ?? ""}>
            <option value="">No client</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField
          id="leadId"
          label="Project lead"
          error={err("leadId")}
          hint="Only admins and project leads can lead a project."
        >
          <Select id="leadId" name="leadId" defaultValue={defaults?.leadId ?? ""}>
            <option value="">{editing ? "No lead" : "Me (if I'm a project lead)"}</option>
            {leads.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name ?? u.email} ({roleLabel[u.role]})
              </option>
            ))}
          </Select>
        </FormField>
        <div className="grid grid-cols-2 gap-4">
          <FormField id="startDate" label="Start date" error={err("startDate")}>
            <Input
              id="startDate"
              name="startDate"
              type="date"
              defaultValue={toDateInput(defaults?.startDate ?? null)}
              {...aria("startDate")}
            />
          </FormField>
          <FormField id="dueDate" label="Due date" error={err("dueDate")}>
            <Input
              id="dueDate"
              name="dueDate"
              type="date"
              defaultValue={toDateInput(defaults?.dueDate ?? null)}
              {...aria("dueDate")}
            />
          </FormField>
        </div>
        <div className="sm:col-span-2">
          <FormField id="description" label="Description" error={err("description")}>
            <Textarea
              id="description"
              name="description"
              rows={4}
              defaultValue={defaults?.description ?? ""}
              {...aria("description")}
            />
          </FormField>
        </div>
      </section>

      <section className="space-y-4 border-t pt-6">
        <h2 className="text-sm font-semibold">Links and stack</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <FormField id="repoUrl" label="Repository URL" error={err("repoUrl")}>
            <Input
              id="repoUrl"
              name="repoUrl"
              type="url"
              placeholder="https://github.com/org/repo"
              defaultValue={defaults?.repoUrl ?? ""}
              {...aria("repoUrl")}
            />
          </FormField>
          <FormField id="stagingUrl" label="Staging URL" error={err("stagingUrl")}>
            <Input
              id="stagingUrl"
              name="stagingUrl"
              type="url"
              placeholder="https://staging.example.com"
              defaultValue={defaults?.stagingUrl ?? ""}
              {...aria("stagingUrl")}
            />
          </FormField>
          <FormField id="productionUrl" label="Production URL" error={err("productionUrl")}>
            <Input
              id="productionUrl"
              name="productionUrl"
              type="url"
              placeholder="https://example.com"
              defaultValue={defaults?.productionUrl ?? ""}
              {...aria("productionUrl")}
            />
          </FormField>
        </div>
        <FormField
          id="technologies"
          label="Technologies"
          error={err("technologies")}
          hint="Comma separated, for example: Next.js, React Native, MongoDB"
        >
          <Input
            id="technologies"
            value={techText}
            onChange={(e) => setTechText(e.target.value)}
            {...aria("technologies")}
          />
        </FormField>
      </section>

      <div className="flex justify-end gap-2 border-t pt-6">
        <Button type="button" variant="secondary" onClick={() => router.back()} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" loading={pending}>
          {editing ? "Save changes" : "Create project"}
        </Button>
      </div>
    </form>
  );
}
