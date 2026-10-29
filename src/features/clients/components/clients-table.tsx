"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { useServerAction } from "@/hooks/use-server-action";
import { deleteClientAction } from "../actions";
import { ClientDialog, type ClientRecord } from "./client-dialog";

type Row = ClientRecord & { _count: { projects: number } };

export function ClientsTable({
  clients,
  canDelete,
  filtered,
}: {
  clients: Row[];
  canDelete: boolean;
  filtered: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<ClientRecord | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<Row | null>(null);
  const remove = useServerAction(deleteClientAction);

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setCreating(true)}>
          <Plus /> New client
        </Button>
      </div>

      {clients.length === 0 ? (
        <EmptyState
          icon={Building2}
          title={filtered ? "No clients match your search" : "No clients yet"}
          description={
            filtered
              ? "Try a different name."
              : "Add a client to link projects and keep contact details in one place."
          }
        />
      ) : (
        <div className="bg-surface overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="text-muted border-b text-left text-xs">
              <tr>
                <th className="px-4 py-2 font-medium">Client</th>
                <th className="px-4 py-2 font-medium">Contact</th>
                <th className="hidden px-4 py-2 font-medium md:table-cell">Email</th>
                <th className="px-4 py-2 text-right font-medium">Projects</th>
                <th className="w-10 px-2 py-2">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {clients.map((c) => (
                <tr key={c.id} className="hover:bg-surface-muted/50">
                  <td className="px-4 py-2.5">
                    <p className="font-medium">{c.name}</p>
                    {c.company && <p className="text-muted text-xs">{c.company}</p>}
                  </td>
                  <td className="px-4 py-2.5">{c.contactName ?? <span className="text-muted">—</span>}</td>
                  <td className="hidden px-4 py-2.5 md:table-cell">
                    {c.email ? (
                      <a href={`mailto:${c.email}`} className="text-primary hover:underline">
                        {c.email}
                      </a>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{c._count.projects}</td>
                  <td className="px-2 py-2.5">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="icon" variant="ghost" aria-label={`Actions for ${c.name}`}>
                          <MoreHorizontal />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem onSelect={() => setEditing(c)}>
                          <Pencil /> Edit
                        </DropdownMenuItem>
                        {canDelete && (
                          <DropdownMenuItem destructive onSelect={() => setDeleting(c)}>
                            <Trash2 /> Delete
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ClientDialog open={creating} onOpenChange={setCreating} />
      <ClientDialog open={Boolean(editing)} onOpenChange={(o) => !o && setEditing(null)} client={editing} />
      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Delete ${deleting?.name ?? "client"}?`}
        description={
          deleting?._count.projects
            ? `Its ${deleting._count.projects} project(s) will be kept but no longer linked to a client.`
            : "This client will be permanently deleted."
        }
        confirmLabel="Delete client"
        destructive
        onConfirm={async () => {
          if (!deleting) return;
          const ok = await remove.run({ id: deleting.id }, { success: "Client deleted" });
          if (ok) router.refresh();
          return Boolean(ok);
        }}
      />
    </>
  );
}
