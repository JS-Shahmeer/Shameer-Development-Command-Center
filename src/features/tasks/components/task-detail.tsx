"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckSquare, Link2, MessageSquare, Pencil, Plus, Trash2, X } from "lucide-react";
import type { TaskStatus } from "@prisma/client";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Select, Textarea } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { RelativeTime } from "@/components/shared/relative-time";
import { useServerAction } from "@/hooks/use-server-action";
import { displayName } from "@/lib/utils";
import {
  addCommentAction,
  addCriterionAction,
  addDependencyAction,
  deleteCommentAction,
  deleteCriterionAction,
  deleteTaskAction,
  removeDependencyAction,
  toggleCriterionAction,
} from "../actions";
import { TaskStatusBadge } from "./badges";
import { TaskDialog, type AssigneeOption, type TaskDefaults } from "./task-dialog";

type Person = { id: string; name: string | null; email: string; image: string | null };
type Linked = { id: string; title: string; status: TaskStatus };

export function TaskEditButton(props: {
  task: TaskDefaults;
  assignees: AssigneeOption[];
  currentUserId: string;
  canAssignOthers: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <Pencil /> Edit
      </Button>
      <TaskDialog open={open} onOpenChange={setOpen} {...props} />
    </>
  );
}

export function TaskDeleteButton({
  taskId,
  title,
  projectSlug,
}: {
  taskId: string;
  title: string;
  projectSlug: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { run } = useServerAction(deleteTaskAction);
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <Trash2 /> Delete
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Delete this task?"
        description={`"${title}" and its comments, criteria and dependency links will be permanently deleted.`}
        confirmLabel="Delete task"
        destructive
        onConfirm={async () => {
          const ok = await run({ id: taskId }, { success: "Task deleted" });
          if (ok) router.push(`/projects/${projectSlug}/tasks`);
          return Boolean(ok);
        }}
      />
    </>
  );
}

/** Flips immediately and rolls back if the server refuses. */
function CriterionCheckbox({
  id,
  text,
  done,
  disabled,
  onToggle,
}: {
  id: string;
  text: string;
  done: boolean;
  disabled: boolean;
  onToggle: (done: boolean) => Promise<boolean>;
}) {
  const [checked, setChecked] = useState(done);
  const [synced, setSynced] = useState(done);
  if (synced !== done) {
    setSynced(done);
    setChecked(done);
  }
  return (
    <input
      type="checkbox"
      id={`criterion-${id}`}
      className="mt-0.5 size-4 accent-[var(--primary)]"
      checked={checked}
      disabled={disabled}
      aria-label={text}
      onChange={async (e) => {
        const next = e.target.checked;
        setChecked(next);
        if (!(await onToggle(next))) setChecked(!next);
      }}
    />
  );
}

export function CriteriaPanel({
  taskId,
  criteria,
  canEdit,
  canTick,
}: {
  taskId: string;
  criteria: { id: string; text: string; done: boolean }[];
  canEdit: boolean;
  canTick: boolean;
}) {
  const router = useRouter();
  const add = useServerAction(addCriterionAction);
  const toggle = useServerAction(toggleCriterionAction);
  const remove = useServerAction(deleteCriterionAction);
  const done = criteria.filter((c) => c.done).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckSquare className="text-muted size-4" aria-hidden /> Acceptance criteria
          {criteria.length > 0 && (
            <span className="text-muted font-normal">
              {done}/{criteria.length}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {criteria.length ? (
          <ul className="space-y-1.5">
            {criteria.map((c) => (
              <li key={c.id} className="group flex items-start gap-2 text-sm">
                <CriterionCheckbox
                  id={c.id}
                  text={c.text}
                  done={c.done}
                  disabled={!canTick}
                  onToggle={async (done) => {
                    const ok = await toggle.run({ id: c.id, done });
                    if (ok) router.refresh();
                    return Boolean(ok);
                  }}
                />
                <label
                  htmlFor={`criterion-${c.id}`}
                  className={`flex-1 ${c.done ? "text-muted line-through" : ""}`}
                >
                  {c.text}
                </label>
                {canEdit && (
                  <button
                    type="button"
                    className="text-muted hover:text-danger rounded p-0.5 opacity-0 group-hover:opacity-100 focus:opacity-100"
                    aria-label={`Remove criterion: ${c.text}`}
                    onClick={async () => {
                      if (await remove.run({ id: c.id })) router.refresh();
                    }}
                  >
                    <X className="size-4" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted text-sm">
            No acceptance criteria yet. Add what &ldquo;done&rdquo; means for this task.
          </p>
        )}
        {canEdit && (
          <form
            className="flex gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              const formEl = e.currentTarget;
              const text = String(new FormData(formEl).get("text") ?? "");
              if (await add.run({ taskId, text })) {
                formEl.reset();
                router.refresh();
              }
            }}
          >
            <Input
              name="text"
              placeholder="Add a criterion"
              aria-label="New acceptance criterion"
              aria-invalid={Boolean(add.fieldErrors.text)}
            />
            <Button type="submit" variant="secondary" loading={add.pending}>
              <Plus /> Add
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

export function DependenciesPanel({
  taskId,
  dependsOn,
  dependents,
  candidates,
  canEdit,
}: {
  taskId: string;
  dependsOn: Linked[];
  dependents: Linked[];
  candidates: Linked[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const add = useServerAction(addDependencyAction);
  const remove = useServerAction(removeDependencyAction);

  const row = (t: Linked, onRemove?: () => void) => (
    <li key={t.id} className="flex items-center gap-2 py-1.5 text-sm">
      <TaskStatusBadge status={t.status} />
      <Link href={`/tasks/${t.id}`} className="min-w-0 flex-1 truncate hover:underline">
        {t.title}
      </Link>
      {onRemove && (
        <Button size="icon" variant="ghost" aria-label={`Remove dependency on ${t.title}`} onClick={onRemove}>
          <X />
        </Button>
      )}
    </li>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Link2 className="text-muted size-4" aria-hidden /> Dependencies
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <h3 className="text-muted mb-1 text-xs font-medium">Depends on</h3>
          {dependsOn.length ? (
            <ul className="divide-y">
              {dependsOn.map((t) =>
                row(
                  t,
                  canEdit
                    ? async () => {
                        if (
                          await remove.run({ taskId, dependsOnId: t.id }, { success: "Dependency removed" })
                        )
                          router.refresh();
                      }
                    : undefined,
                ),
              )}
            </ul>
          ) : (
            <p className="text-muted text-sm">Nothing. This task can start any time.</p>
          )}
          {canEdit && candidates.length > 0 && (
            <form
              className="mt-2 flex gap-2"
              onSubmit={async (e) => {
                e.preventDefault();
                const dependsOnId = String(new FormData(e.currentTarget).get("dependsOnId") ?? "");
                if (await add.run({ taskId, dependsOnId }, { success: "Dependency added" })) router.refresh();
              }}
            >
              <Select name="dependsOnId" aria-label="Task this depends on" required>
                {candidates.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </Select>
              <Button type="submit" variant="secondary" loading={add.pending}>
                <Plus /> Add
              </Button>
            </form>
          )}
        </div>
        {dependents.length > 0 && (
          <div>
            <h3 className="text-muted mb-1 text-xs font-medium">Blocks</h3>
            <ul className="divide-y">{dependents.map((t) => row(t))}</ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function CommentsPanel({
  taskId,
  comments,
  currentUserId,
  canComment,
  canModerate,
}: {
  taskId: string;
  comments: { id: string; body: string; createdAt: Date; author: Person | null }[];
  currentUserId: string;
  canComment: boolean;
  canModerate: boolean;
}) {
  const router = useRouter();
  const add = useServerAction(addCommentAction);
  const remove = useServerAction(deleteCommentAction);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="text-muted size-4" aria-hidden /> Comments ({comments.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {comments.length ? (
          <ul className="space-y-4">
            {comments.map((c) => (
              <li key={c.id} className="flex gap-3">
                {c.author ? <Avatar user={c.author} /> : <span className="size-7" />}
                <div className="min-w-0 flex-1">
                  <p className="text-muted text-xs">
                    <span className="text-foreground font-medium">
                      {c.author ? displayName(c.author) : "Former member"}
                    </span>{" "}
                    · <RelativeTime date={c.createdAt} />
                    {(canModerate || c.author?.id === currentUserId) && (
                      <button
                        type="button"
                        className="text-muted hover:text-danger ml-2"
                        onClick={async () => {
                          if (await remove.run({ id: c.id }, { success: "Comment deleted" }))
                            router.refresh();
                        }}
                      >
                        Delete
                      </button>
                    )}
                  </p>
                  <p className="mt-1 text-sm break-words whitespace-pre-wrap">{c.body}</p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted text-sm">No comments yet.</p>
        )}
        {canComment && (
          <form
            className="space-y-2"
            onSubmit={async (e) => {
              e.preventDefault();
              const formEl = e.currentTarget;
              const body = String(new FormData(formEl).get("body") ?? "");
              if (await add.run({ taskId, body })) {
                formEl.reset();
                router.refresh();
              }
            }}
          >
            <Textarea
              name="body"
              rows={3}
              placeholder="Write a comment"
              aria-label="New comment"
              aria-invalid={Boolean(add.fieldErrors.body)}
            />
            <div className="flex justify-end">
              <Button type="submit" loading={add.pending}>
                Comment
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
