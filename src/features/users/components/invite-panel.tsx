"use client";

import { useRouter } from "next/navigation";
import { Copy, MailPlus, X } from "lucide-react";
import { toast } from "sonner";
import type { Role } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { FormField } from "@/components/shared/form-field";
import { formatDate } from "@/components/shared/relative-time";
import { useServerAction } from "@/hooks/use-server-action";
import { createInviteAction, revokeInviteAction } from "../actions";
import { ROLES, roleLabel } from "../schemas";

type Invite = { id: string; email: string; role: Role; expiresAt: Date };

export function InvitePanel({ invites, signInUrl }: { invites: Invite[]; signInUrl: string }) {
  const router = useRouter();
  const create = useServerAction(createInviteAction);
  const revoke = useServerAction(revokeInviteAction);
  const now = new Date();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MailPlus className="text-muted size-4" aria-hidden /> Invite someone
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <form
          noValidate
          className="flex flex-col gap-3 sm:flex-row sm:items-start"
          onSubmit={async (e) => {
            e.preventDefault();
            const formEl = e.currentTarget;
            const f = new FormData(formEl);
            const ok = await create.run({ email: String(f.get("email") ?? ""), role: f.get("role") as Role });
            if (ok) {
              toast.success(`Invited ${ok.data.email}`, {
                description:
                  "Send them the sign-in link. They sign in with the GitHub account that uses this email.",
              });
              formEl.reset();
              router.refresh();
            }
          }}
        >
          <div className="flex-1">
            <FormField id="invite-email" label="Email" error={create.fieldErrors.email}>
              <Input
                id="invite-email"
                name="email"
                type="email"
                placeholder="dev@company.com"
                aria-invalid={Boolean(create.fieldErrors.email)}
              />
            </FormField>
          </div>
          <div className="sm:w-44">
            <FormField id="invite-role" label="Role">
              <Select id="invite-role" name="role" defaultValue="DEVELOPER">
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {roleLabel[r]}
                  </option>
                ))}
              </Select>
            </FormField>
          </div>
          <Button type="submit" loading={create.pending} className="sm:mt-6">
            Send invite
          </Button>
        </form>

        <div className="bg-surface-muted flex items-center justify-between gap-2 rounded-md px-3 py-2 text-xs">
          <span className="truncate font-mono">{signInUrl}</span>
          <Button
            size="sm"
            variant="ghost"
            onClick={async () => {
              await navigator.clipboard.writeText(signInUrl);
              toast.success("Sign-in link copied");
            }}
          >
            <Copy /> Copy link
          </Button>
        </div>

        {invites.length > 0 && (
          <div>
            <h3 className="text-muted mb-2 text-xs font-medium">Pending invites</h3>
            <ul className="divide-y rounded-md border">
              {invites.map((i) => {
                const expired = i.expiresAt < now;
                return (
                  <li key={i.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                    <span className="min-w-0 flex-1 truncate">{i.email}</span>
                    <Badge>{roleLabel[i.role]}</Badge>
                    <span className={`hidden text-xs sm:inline ${expired ? "text-danger" : "text-muted"}`}>
                      {expired ? "Expired" : `Expires ${formatDate(i.expiresAt)}`}
                    </span>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`Revoke invite for ${i.email}`}
                      disabled={revoke.pending}
                      onClick={async () => {
                        if (await revoke.run({ id: i.id }, { success: "Invite revoked" })) router.refresh();
                      }}
                    >
                      <X />
                    </Button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
