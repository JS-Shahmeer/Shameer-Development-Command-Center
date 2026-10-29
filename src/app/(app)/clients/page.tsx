import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Search } from "lucide-react";
import { requireUser } from "@/lib/session";
import { can } from "@/lib/permissions";
import { listClients } from "@/features/clients/service";
import { ClientsTable } from "@/features/clients/components/clients-table";
import { PageHeader } from "@/components/shared/page-header";
import { Input } from "@/components/ui/input";

export const metadata: Metadata = { title: "Clients" };

export default async function ClientsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await requireUser();
  if (!can.manageClients(user)) redirect("/dashboard");
  const q = (await searchParams).q?.trim() || undefined;
  const clients = await listClients(user, q);

  return (
    <>
      <PageHeader title="Clients" description="Who you build for, and how to reach them." />
      <form role="search" className="relative mb-4 max-w-sm">
        <Search
          className="text-muted pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2"
          aria-hidden
        />
        <Input
          name="q"
          defaultValue={q}
          placeholder="Search clients"
          className="pl-8"
          aria-label="Search clients"
        />
      </form>
      <ClientsTable clients={clients} canDelete={can.deleteClient(user)} filtered={Boolean(q)} />
    </>
  );
}
