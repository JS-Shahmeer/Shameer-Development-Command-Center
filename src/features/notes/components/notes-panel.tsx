"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal, NotebookPen, Pencil, Pin, PinOff, Plus, Trash2 } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input, Textarea } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { FormField } from "@/components/shared/form-field";
import { RelativeTime } from "@/components/shared/relative-time";
import { useServerAction } from "@/hooks/use-server-action";
import { displayName } from "@/lib/utils";
import { createNoteAction, deleteNoteAction, pinNoteAction, updateNoteAction } from "../actions";

export type NoteItem = {
  id: string;
  title: string;
  body: string;
  pinned: boolean;
  updatedAt: Date;
  canEdit: boolean;
  author: { id: string; name: string | null; email: string; image: string | null } | null;
};

export function NotesPanel({
  projectId,
  notes,
  canCreate,
}: {
  projectId: string;
  notes: NoteItem[];
  canCreate: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<NoteItem | "new" | null>(null);
  const [deleting, setDeleting] = useState<NoteItem | null>(null);
  const create = useServerAction(createNoteAction);
  const update = useServerAction(updateNoteAction);
  const pin = useServerAction(pinNoteAction);
  const remove = useServerAction(deleteNoteAction);
  const form = editing === "new" ? create : update;
  const err = (k: string) => form.fieldErrors[`data.${k}`] ?? form.fieldErrors[k];

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const data = {
      title: String(f.get("title") ?? ""),
      body: String(f.get("body") ?? ""),
      pinned: f.get("pinned") === "on",
    };
    const ok =
      editing === "new"
        ? await create.run({ projectId, data }, { success: "Note added" })
        : editing
          ? await update.run({ id: editing.id, data }, { success: "Note saved" })
          : null;
    if (ok) {
      setEditing(null);
      router.refresh();
    }
  }

  const current = editing && editing !== "new" ? editing : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <NotebookPen className="text-muted size-4" aria-hidden /> Notes ({notes.length})
        </CardTitle>
        {canCreate && (
          <Button size="sm" variant="secondary" onClick={() => setEditing("new")}>
            <Plus /> Add note
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {notes.length ? (
          <ul className="space-y-3">
            {notes.map((n) => (
              <li key={n.id} className="rounded-md border p-3">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="flex items-center gap-2 text-sm font-medium">
                    {n.pinned && <Pin className="text-primary size-3.5" aria-label="Pinned" />}
                    {n.title}
                  </h3>
                  {n.canEdit && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="icon" variant="ghost" aria-label={`Actions for ${n.title}`}>
                          <MoreHorizontal />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem onSelect={() => setEditing(n)}>
                          <Pencil /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          disabled={pin.pending}
                          onSelect={async () => {
                            if (
                              await pin.run(
                                { id: n.id, pinned: !n.pinned },
                                { success: n.pinned ? "Unpinned" : "Pinned" },
                              )
                            )
                              router.refresh();
                          }}
                        >
                          {n.pinned ? <PinOff /> : <Pin />} {n.pinned ? "Unpin" : "Pin to top"}
                        </DropdownMenuItem>
                        <DropdownMenuItem destructive onSelect={() => setDeleting(n)}>
                          <Trash2 /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
                <p className="text-foreground/90 mt-1 text-sm break-words whitespace-pre-wrap">{n.body}</p>
                <p className="text-muted mt-2 flex items-center gap-1.5 text-xs">
                  {n.author && <Avatar user={n.author} className="size-4 text-[8px]" />}
                  {n.author ? displayName(n.author) : "Former member"} · <RelativeTime date={n.updatedAt} />
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            icon={NotebookPen}
            title="No notes yet"
            description="Keep decisions, credentials locations, deployment steps and client feedback here."
            className="py-8"
          />
        )}
      </CardContent>

      <Dialog open={Boolean(editing)} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent title={current ? "Edit note" : "New note"} className="max-w-2xl">
          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            <FormField id="note-title" label="Title" required error={err("title")}>
              <Input
                id="note-title"
                name="title"
                defaultValue={current?.title}
                maxLength={160}
                autoFocus
                aria-invalid={Boolean(err("title"))}
              />
            </FormField>
            <FormField
              id="note-body"
              label="Note"
              required
              error={err("body")}
              hint="Never paste passwords or API keys. Note where they live instead."
            >
              <Textarea
                id="note-body"
                name="body"
                rows={8}
                defaultValue={current?.body}
                aria-invalid={Boolean(err("body"))}
              />
            </FormField>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="pinned"
                defaultChecked={current?.pinned}
                className="size-4 accent-[var(--primary)]"
              />
              Pin to top
            </label>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setEditing(null)}>
                Cancel
              </Button>
              <Button type="submit" loading={form.pending}>
                {current ? "Save note" : "Add note"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete this note?"
        description={`"${deleting?.title ?? ""}" will be permanently deleted.`}
        confirmLabel="Delete note"
        destructive
        onConfirm={async () => {
          if (!deleting) return;
          const ok = await remove.run({ id: deleting.id }, { success: "Note deleted" });
          if (ok) router.refresh();
          return Boolean(ok);
        }}
      />
    </Card>
  );
}
