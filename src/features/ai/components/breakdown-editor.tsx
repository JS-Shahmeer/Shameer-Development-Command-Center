"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, HelpCircle, Plus, Save, Trash2 } from "lucide-react";
import type { TaskPriority } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { useServerAction } from "@/hooks/use-server-action";
import { cn } from "@/lib/utils";
import { TASK_PRIORITIES, taskPriorityLabel } from "@/features/tasks/schemas";
import { PriorityLabel } from "@/features/tasks/components/badges";
import { approveBreakdownAction, discardBreakdownAction, saveDraftAction } from "../actions";
import { MAX_DRAFT_ITEMS, type Draft, type DraftItem } from "../schemas";

type Member = { id: string; name: string | null; email: string };

const linesToList = (text: string) =>
  text
    .split("\n")
    .map((l) => l.replace(/^[-*\s]+/, "").trim())
    .filter(Boolean);

function nextRef(items: DraftItem[]) {
  let n = items.length + 1;
  const refs = new Set(items.map((i) => i.ref));
  while (refs.has(`T${n}`)) n++;
  return `T${n}`;
}

/**
 * Review screen for an AI draft. Every field is editable; nothing becomes a task until Approve.
 * The server re-validates the whole draft on save and approve.
 */
export function BreakdownEditor({
  id,
  projectSlug,
  initial,
  members,
  readOnly,
}: {
  id: string;
  projectSlug: string;
  initial: Draft;
  members: Member[];
  readOnly: boolean;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>(initial);
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState<"BACKLOG" | "TODO">("BACKLOG");
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  // Criteria are edited as free text and parsed on save, so blank lines don't vanish while typing.
  const [criteriaText, setCriteriaText] = useState(() =>
    Object.fromEntries(initial.items.map((i) => [i.ref, i.acceptanceCriteria.join("\n")])),
  );

  const save = useServerAction(saveDraftAction);
  const approve = useServerAction(approveBreakdownAction);
  const discard = useServerAction(discardBreakdownAction);
  const busy = save.pending || approve.pending || discard.pending;
  const fieldErrors = { ...save.fieldErrors, ...approve.fieldErrors };

  const included = draft.items.filter((i) => i.include);
  const totalHours = included.reduce((n, i) => n + (i.estimateHours ?? 0), 0);

  const update = (ref: string, patch: Partial<DraftItem>) => {
    setDirty(true);
    setDraft((d) => ({ ...d, items: d.items.map((i) => (i.ref === ref ? { ...i, ...patch } : i)) }));
  };

  const remove = (ref: string) => {
    setDirty(true);
    setDraft((d) => ({
      ...d,
      items: d.items
        .filter((i) => i.ref !== ref)
        .map((i) => ({ ...i, dependsOn: i.dependsOn.filter((r) => r !== ref) })),
    }));
  };

  const add = () => {
    const ref = nextRef(draft.items);
    setDirty(true);
    setCriteriaText((c) => ({ ...c, [ref]: "" }));
    setDraft((d) => ({
      ...d,
      items: [
        ...d.items,
        {
          ref,
          include: true,
          title: "",
          description: "",
          priority: "MEDIUM",
          estimateHours: null,
          assigneeId: null,
          acceptanceCriteria: [],
          dependsOn: [],
        },
      ],
    }));
  };

  const current = (): Draft => ({
    ...draft,
    items: draft.items.map((i) => ({ ...i, acceptanceCriteria: linesToList(criteriaText[i.ref] ?? "") })),
  });

  async function onSave() {
    const ok = await save.run({ id, draft: current() }, { success: "Draft saved" });
    if (ok) setDirty(false);
  }

  async function onApprove() {
    const result = await approve.run(
      { id, draft: current(), status },
      { success: `Created ${included.length} ${included.length === 1 ? "task" : "tasks"}` },
    );
    if (result) {
      router.push(`/projects/${projectSlug}/tasks`);
      router.refresh();
    }
  }

  const itemError = (index: number, key: string) =>
    fieldErrors[`draft.items.${index}.${key}`]?.[0] ?? fieldErrors[`items.${index}.${key}`]?.[0];

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Summary</CardTitle>
          </CardHeader>
          <CardContent>
            {draft.summary ? (
              <p className="text-sm whitespace-pre-wrap">{draft.summary}</p>
            ) : (
              <p className="text-muted text-sm">No summary.</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HelpCircle className="text-muted size-4" aria-hidden /> Open questions
            </CardTitle>
          </CardHeader>
          <CardContent>
            {draft.openQuestions.length ? (
              <ul className="list-disc space-y-1.5 pl-5 text-sm">
                {draft.openQuestions.map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ul>
            ) : (
              <p className="text-muted text-sm">None. The requirement looked clear.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">
          Tasks{" "}
          <span className="text-muted text-sm font-normal">
            {included.length} of {draft.items.length} selected
            {totalHours ? `, about ${totalHours}h` : ""}
          </span>
        </h2>
        {!readOnly && (
          <Button
            variant="secondary"
            size="sm"
            onClick={add}
            disabled={busy || draft.items.length >= MAX_DRAFT_ITEMS}
          >
            <Plus /> Add task
          </Button>
        )}
      </div>

      {fieldErrors.draft?.[0] || fieldErrors["draft.items"]?.[0] ? (
        <p className="text-danger text-sm" role="alert">
          {fieldErrors.draft?.[0] ?? fieldErrors["draft.items"]?.[0]}
        </p>
      ) : null}

      <ol className="space-y-3">
        {draft.items.map((item, index) => {
          const others = draft.items.filter((o) => o.ref !== item.ref);
          const prefix = `item-${item.ref}`;
          if (readOnly) {
            return (
              <li
                key={item.ref}
                className={cn("bg-surface rounded-lg border p-4", !item.include && "opacity-60")}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-muted font-mono text-xs">{item.ref}</span>
                  <span className="font-medium">{item.title}</span>
                  {!item.include && <span className="text-muted text-xs">(not created)</span>}
                  <PriorityLabel priority={item.priority} className="ml-auto" />
                  {item.estimateHours != null && (
                    <span className="text-muted text-xs tabular-nums">{item.estimateHours}h</span>
                  )}
                </div>
                {item.description && <p className="text-muted mt-1 text-sm">{item.description}</p>}
                {item.acceptanceCriteria.length > 0 && (
                  <ul className="mt-2 list-disc pl-5 text-sm">
                    {item.acceptanceCriteria.map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                )}
                {item.dependsOn.length > 0 && (
                  <p className="text-muted mt-2 text-xs">Depends on {item.dependsOn.join(", ")}</p>
                )}
              </li>
            );
          }
          return (
            <li
              key={item.ref}
              className={cn("bg-surface rounded-lg border p-4", !item.include && "bg-surface-muted/50")}
            >
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  className="accent-primary mt-2.5 size-4"
                  checked={item.include}
                  onChange={(e) => update(item.ref, { include: e.target.checked })}
                  aria-label={`Create task ${item.ref}`}
                  disabled={busy}
                />
                <div className={cn("min-w-0 flex-1 space-y-3", !item.include && "opacity-60")}>
                  <div className="flex items-center gap-2">
                    <span className="text-muted w-8 shrink-0 font-mono text-xs">{item.ref}</span>
                    <Input
                      value={item.title}
                      onChange={(e) => update(item.ref, { title: e.target.value })}
                      placeholder="Task title"
                      maxLength={200}
                      aria-label="Title"
                      aria-invalid={Boolean(itemError(index, "title"))}
                      disabled={busy}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => remove(item.ref)}
                      aria-label={`Remove ${item.ref}`}
                      disabled={busy}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                  {itemError(index, "title") && (
                    <p className="text-danger text-xs" role="alert">
                      {itemError(index, "title")}
                    </p>
                  )}
                  <Textarea
                    value={item.description}
                    onChange={(e) => update(item.ref, { description: e.target.value })}
                    rows={2}
                    placeholder="Description"
                    aria-label="Description"
                    disabled={busy}
                  />
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="space-y-1.5">
                      <Label htmlFor={`${prefix}-priority`}>Priority</Label>
                      <Select
                        id={`${prefix}-priority`}
                        value={item.priority}
                        onChange={(e) => update(item.ref, { priority: e.target.value as TaskPriority })}
                        disabled={busy}
                      >
                        {TASK_PRIORITIES.map((p) => (
                          <option key={p} value={p}>
                            {taskPriorityLabel[p]}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor={`${prefix}-estimate`}>Estimate (hours)</Label>
                      <Input
                        id={`${prefix}-estimate`}
                        type="number"
                        min={0}
                        max={1000}
                        step={0.25}
                        value={item.estimateHours ?? ""}
                        onChange={(e) =>
                          update(item.ref, {
                            estimateHours: e.target.value === "" ? null : Number(e.target.value),
                          })
                        }
                        disabled={busy}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor={`${prefix}-assignee`}>Assignee</Label>
                      <Select
                        id={`${prefix}-assignee`}
                        value={item.assigneeId ?? ""}
                        onChange={(e) => update(item.ref, { assigneeId: e.target.value || null })}
                        disabled={busy}
                      >
                        <option value="">Unassigned</option>
                        {members.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name ?? m.email}
                          </option>
                        ))}
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={`${prefix}-criteria`}>Acceptance criteria (one per line)</Label>
                    <Textarea
                      id={`${prefix}-criteria`}
                      rows={Math.min(Math.max((criteriaText[item.ref] ?? "").split("\n").length, 2), 8)}
                      value={criteriaText[item.ref] ?? ""}
                      onChange={(e) => {
                        setDirty(true);
                        setCriteriaText((c) => ({ ...c, [item.ref]: e.target.value }));
                      }}
                      disabled={busy}
                    />
                  </div>
                  {others.length > 0 && (
                    <fieldset className="space-y-1.5">
                      <legend className="text-sm font-medium">Depends on</legend>
                      <div className="flex flex-wrap gap-1.5">
                        {others.map((o) => {
                          const on = item.dependsOn.includes(o.ref);
                          return (
                            <button
                              key={o.ref}
                              type="button"
                              aria-pressed={on}
                              title={o.title}
                              disabled={busy}
                              onClick={() =>
                                update(item.ref, {
                                  dependsOn: on
                                    ? item.dependsOn.filter((r) => r !== o.ref)
                                    : [...item.dependsOn, o.ref],
                                })
                              }
                              className={cn(
                                "max-w-56 truncate rounded-full border px-2 py-0.5 text-xs",
                                on
                                  ? "border-primary/40 bg-primary/10 text-primary"
                                  : "text-muted hover:bg-surface-muted",
                                !o.include && "line-through",
                              )}
                            >
                              {o.ref} {o.title || "Untitled"}
                            </button>
                          );
                        })}
                      </div>
                    </fieldset>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      {!readOnly && (
        <div className="bg-surface sticky bottom-0 -mx-1 flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 shadow-sm">
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => setConfirmDiscard(true)} disabled={busy}>
              <Trash2 /> Discard
            </Button>
            <Button variant="secondary" onClick={onSave} loading={save.pending} disabled={busy || !dirty}>
              <Save /> {dirty ? "Save draft" : "Saved"}
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="approve-status" className="text-muted text-sm font-normal">
              Create in
            </Label>
            <Select
              id="approve-status"
              value={status}
              onChange={(e) => setStatus(e.target.value as "BACKLOG" | "TODO")}
              className="w-32"
              disabled={busy}
            >
              <option value="BACKLOG">Backlog</option>
              <option value="TODO">To do</option>
            </Select>
            <Button onClick={onApprove} loading={approve.pending} disabled={busy || !included.length}>
              <CheckCircle2 /> Approve {included.length} {included.length === 1 ? "task" : "tasks"}
            </Button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmDiscard}
        onOpenChange={setConfirmDiscard}
        title="Discard this draft?"
        description="No tasks will be created. The draft stays in the history as discarded."
        confirmLabel="Discard draft"
        destructive
        onConfirm={async () => {
          const ok = await discard.run({ id }, { success: "Draft discarded" });
          if (!ok) return false;
          router.push(`/projects/${projectSlug}/breakdown`);
        }}
      />
    </div>
  );
}
