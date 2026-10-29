"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input, Textarea } from "@/components/ui/input";
import { FormField } from "@/components/shared/form-field";
import { useServerAction } from "@/hooks/use-server-action";
import { createClientAction, updateClientAction } from "../actions";

export type ClientRecord = {
  id: string;
  name: string;
  company: string | null;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
};

export function ClientDialog({
  open,
  onOpenChange,
  client,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client?: ClientRecord | null;
}) {
  const router = useRouter();
  const create = useServerAction(createClientAction);
  const update = useServerAction(updateClientAction);
  const { pending, fieldErrors } = client ? update : create;
  const err = (k: string) => fieldErrors[`data.${k}`] ?? fieldErrors[k];

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const get = (k: string) => String(f.get(k) ?? "");
    const data = {
      name: get("name"),
      company: get("company"),
      contactName: get("contactName"),
      email: get("email"),
      phone: get("phone"),
      notes: get("notes"),
    };
    const ok = client
      ? await update.run({ id: client.id, data }, { success: "Client saved" })
      : await create.run(data, { success: "Client added" });
    if (ok) {
      onOpenChange(false);
      router.refresh();
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={client ? `Edit ${client.name}` : "New client"} className="max-w-xl">
        <form onSubmit={onSubmit} className="space-y-4" noValidate key={client?.id ?? "new"}>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="c-name" label="Client name" required error={err("name")}>
              <Input
                id="c-name"
                name="name"
                defaultValue={client?.name}
                autoFocus
                aria-invalid={Boolean(err("name"))}
              />
            </FormField>
            <FormField id="c-company" label="Company" error={err("company")}>
              <Input id="c-company" name="company" defaultValue={client?.company ?? ""} />
            </FormField>
            <FormField id="c-contact" label="Contact person" error={err("contactName")}>
              <Input id="c-contact" name="contactName" defaultValue={client?.contactName ?? ""} />
            </FormField>
            <FormField id="c-email" label="Email" error={err("email")}>
              <Input
                id="c-email"
                name="email"
                type="email"
                defaultValue={client?.email ?? ""}
                aria-invalid={Boolean(err("email"))}
              />
            </FormField>
            <FormField id="c-phone" label="Phone" error={err("phone")}>
              <Input id="c-phone" name="phone" type="tel" defaultValue={client?.phone ?? ""} />
            </FormField>
          </div>
          <FormField id="c-notes" label="Notes" error={err("notes")}>
            <Textarea id="c-notes" name="notes" rows={3} defaultValue={client?.notes ?? ""} />
          </FormField>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={pending}>
              {client ? "Save client" : "Add client"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
