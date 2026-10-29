"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Crown, Plus, UserMinus, Users } from "lucide-react";
import type { ProjectRole, Role } from "@prisma/client";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Select } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { FormField } from "@/components/shared/form-field";
import { useServerAction } from "@/hooks/use-server-action";
import { displayName } from "@/lib/utils";
import { roleLabel } from "@/features/users/schemas";
import { addMemberAction, removeMemberAction } from "../actions";

type Member = {
  id: string;
  role: ProjectRole;
  user: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
    role: Role;
    title: string | null;
  };
};

export function MembersPanel({
  projectId,
  leadId,
  members,
  candidates,
  canManage,
}: {
  projectId: string;
  leadId: string | null;
  members: Member[];
  candidates: { id: string; name: string | null; email: string; role: Role }[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<Member | null>(null);
  const add = useServerAction(addMemberAction);
  const remove = useServerAction(removeMemberAction);
  const available = candidates.filter((c) => !members.some((m) => m.user.id === c.id));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="text-muted size-4" aria-hidden /> Team ({members.length})
        </CardTitle>
        {canManage && (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setAdding(true)}
            disabled={!available.length}
            title={available.length ? undefined : "Everyone is already on this project"}
          >
            <Plus /> Add
          </Button>
        )}
      </CardHeader>
      <CardContent className="py-1">
        {members.length ? (
          <ul className="divide-y">
            {members.map((m) => (
              <li key={m.id} className="flex items-center gap-3 py-2.5">
                <Avatar user={m.user} />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 truncate text-sm font-medium">
                    {displayName(m.user)}
                    {m.user.id === leadId && (
                      <Crown className="text-warning size-3.5" aria-label="Project lead" />
                    )}
                  </p>
                  <p className="text-muted truncate text-xs">{m.user.title ?? roleLabel[m.user.role]}</p>
                </div>
                {m.role === "LEAD" && <Badge tone="primary">Lead</Badge>}
                {canManage && m.user.id !== leadId && (
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`Remove ${displayName(m.user)}`}
                    onClick={() => setRemoving(m)}
                  >
                    <UserMinus />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted py-3 text-sm">No one is on this project yet.</p>
        )}
      </CardContent>

      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent title="Add team member" description="Members can see this project and add notes.">
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const ok = await add.run(
                { projectId, userId: String(f.get("userId")), role: f.get("role") as ProjectRole },
                { success: "Member added" },
              );
              if (ok) {
                setAdding(false);
                router.refresh();
              }
            }}
          >
            <FormField id="userId" label="Person" error={add.fieldErrors.userId}>
              <Select id="userId" name="userId" required>
                {available.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name ?? u.email} ({roleLabel[u.role]})
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField id="role" label="Project role" hint="Only admins and project leads can be a lead.">
              <Select id="role" name="role" defaultValue="MEMBER">
                <option value="MEMBER">Member</option>
                <option value="LEAD">Co-lead</option>
              </Select>
            </FormField>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setAdding(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={add.pending}>
                Add member
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(removing)}
        onOpenChange={(o) => !o && setRemoving(null)}
        title={`Remove ${removing ? displayName(removing.user) : ""}?`}
        description="They will lose access to this project and its notes."
        confirmLabel="Remove"
        destructive
        onConfirm={async () => {
          if (!removing) return;
          const ok = await remove.run({ projectId, userId: removing.user.id }, { success: "Member removed" });
          if (ok) router.refresh();
          return Boolean(ok);
        }}
      />
    </Card>
  );
}
