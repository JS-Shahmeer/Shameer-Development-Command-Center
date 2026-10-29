"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { useServerAction } from "@/hooks/use-server-action";
import { archiveProjectAction } from "../actions";

export function ProjectActions({
  id,
  slug,
  name,
  archived,
}: {
  id: string;
  slug: string;
  name: string;
  archived: boolean;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const { run, pending } = useServerAction(archiveProjectAction);

  const toggle = async () => {
    const ok = await run(
      { id, archived: !archived },
      { success: archived ? "Project restored" : "Project archived" },
    );
    if (ok) router.refresh();
    return Boolean(ok);
  };

  return (
    <>
      <Button asChild variant="secondary">
        <Link href={`/projects/${slug}/edit`}>
          <Pencil /> Edit
        </Link>
      </Button>
      {archived ? (
        <Button variant="secondary" onClick={toggle} loading={pending}>
          <ArchiveRestore /> Restore
        </Button>
      ) : (
        <Button variant="secondary" onClick={() => setConfirming(true)}>
          <Archive /> Archive
        </Button>
      )}
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={`Archive ${name}?`}
        description="It will be hidden from lists and the dashboard. Nothing is deleted, and you can restore it any time."
        confirmLabel="Archive project"
        onConfirm={toggle}
      />
    </>
  );
}
