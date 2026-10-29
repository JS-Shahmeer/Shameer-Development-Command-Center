"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Role } from "@prisma/client";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { useServerAction } from "@/hooks/use-server-action";
import { displayName } from "@/lib/utils";
import { changeRoleAction, setUserActiveAction } from "../actions";
import { ROLES, roleLabel } from "../schemas";

type UserRow = {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  role: Role;
  isActive: boolean;
  _count: { memberships: number };
};

export function UsersTable({ users, currentUserId }: { users: UserRow[]; currentUserId: string }) {
  const router = useRouter();
  const changeRole = useServerAction(changeRoleAction);
  const setActive = useServerAction(setUserActiveAction);
  const [deactivating, setDeactivating] = useState<UserRow | null>(null);

  return (
    <div className="bg-surface overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="text-muted border-b text-left text-xs">
          <tr>
            <th className="px-4 py-2 font-medium">Person</th>
            <th className="px-4 py-2 font-medium">Role</th>
            <th className="hidden px-4 py-2 text-right font-medium sm:table-cell">Projects</th>
            <th className="px-4 py-2 text-right font-medium">Access</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {users.map((u) => {
            const self = u.id === currentUserId;
            return (
              <tr key={u.id} className={u.isActive ? "" : "opacity-60"}>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-3">
                    <Avatar user={u} />
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {displayName(u)} {self && <span className="text-muted text-xs">(you)</span>}
                      </p>
                      <p className="text-muted truncate text-xs">{u.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-2.5">
                  <Select
                    aria-label={`Role for ${displayName(u)}`}
                    className="w-36"
                    defaultValue={u.role}
                    disabled={self || !u.isActive || changeRole.pending}
                    onChange={async (e) => {
                      const role = e.target.value as Role;
                      const ok = await changeRole.run(
                        { userId: u.id, role },
                        { success: `${displayName(u)} is now ${roleLabel[role]}` },
                      );
                      if (!ok) e.target.value = u.role;
                      router.refresh();
                    }}
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {roleLabel[r]}
                      </option>
                    ))}
                  </Select>
                </td>
                <td className="hidden px-4 py-2.5 text-right tabular-nums sm:table-cell">
                  {u._count.memberships}
                </td>
                <td className="px-4 py-2.5 text-right">
                  {self ? (
                    <Badge tone="success">Active</Badge>
                  ) : u.isActive ? (
                    <Button size="sm" variant="secondary" onClick={() => setDeactivating(u)}>
                      Deactivate
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="secondary"
                      loading={setActive.pending}
                      onClick={async () => {
                        if (
                          await setActive.run({ userId: u.id, active: true }, { success: "User reactivated" })
                        )
                          router.refresh();
                      }}
                    >
                      Reactivate
                    </Button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <ConfirmDialog
        open={Boolean(deactivating)}
        onOpenChange={(o) => !o && setDeactivating(null)}
        title={`Deactivate ${deactivating ? displayName(deactivating) : ""}?`}
        description="They are signed out on their next request and can't sign in again until reactivated. Their work stays in place."
        confirmLabel="Deactivate"
        destructive
        onConfirm={async () => {
          if (!deactivating) return;
          const ok = await setActive.run(
            { userId: deactivating.id, active: false },
            { success: "User deactivated" },
          );
          if (ok) router.refresh();
          return Boolean(ok);
        }}
      />
    </div>
  );
}
