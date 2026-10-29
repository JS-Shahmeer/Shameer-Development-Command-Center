import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { can } from "@/lib/permissions";
import { listInvites, listUsers } from "@/features/users/service";
import { InvitePanel } from "@/features/users/components/invite-panel";
import { UsersTable } from "@/features/users/components/users-table";
import { PageHeader } from "@/components/shared/page-header";

export const metadata: Metadata = { title: "Users" };

export default async function UsersPage() {
  const user = await requireUser();
  if (!can.manageUsers(user)) redirect("/dashboard");
  const [users, invites, h] = await Promise.all([listUsers(user), listInvites(user), headers()]);
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");

  return (
    <>
      <PageHeader
        title="Users"
        description="Invite teammates and set what they can do. Only invited emails can sign in."
      />
      <div className="space-y-6">
        <InvitePanel invites={invites} signInUrl={`${proto}://${host}/sign-in`} />
        <UsersTable users={users} currentUserId={user.id} />
      </div>
    </>
  );
}
