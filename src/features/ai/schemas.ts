import { z } from "zod";
import { id } from "@/lib/validation";
import { TASK_PRIORITIES } from "@/features/tasks/schemas";

export const MAX_REQUIREMENT_LENGTH = 20_000;
export const MAX_DRAFT_ITEMS = 40;

/** What we ask Claude to return. Kept to plain types so it maps cleanly onto structured outputs. */
export const claudeBreakdownSchema = z.object({
  summary: z.string().describe("Two or three sentences restating what the client is asking for."),
  openQuestions: z
    .array(z.string())
    .describe("Questions to ask the client where the requirement is ambiguous or missing detail."),
  tasks: z.array(
    z.object({
      ref: z.string().describe('Short unique id for this task, like "T1".'),
      title: z.string().describe("Imperative task title, under 100 characters."),
      description: z.string().describe("What to build and any technical notes, 1-4 sentences."),
      priority: z.enum(TASK_PRIORITIES),
      estimateHours: z.number().describe("Realistic estimate in hours for one developer."),
      acceptanceCriteria: z.array(z.string()).describe("2-5 testable statements of done."),
      dependsOn: z.array(z.string()).describe("refs of tasks in this list that must be finished first."),
    }),
  ),
});

export type ClaudeBreakdown = z.infer<typeof claudeBreakdownSchema>;

/** One editable row of a draft. */
export const draftItemSchema = z.object({
  ref: z.string().trim().min(1).max(20),
  include: z.boolean().default(true),
  title: z.string().trim().min(1, "Every included task needs a title.").max(200),
  description: z.string().trim().max(5000).default(""),
  priority: z.enum(TASK_PRIORITIES).default("MEDIUM"),
  estimateHours: z.number().min(0).max(1000).nullable().default(null),
  assigneeId: z.string().nullable().default(null),
  acceptanceCriteria: z.array(z.string().trim().min(1).max(500)).max(30).default([]),
  dependsOn: z.array(z.string()).max(40).default([]),
});

export type DraftItem = z.infer<typeof draftItemSchema>;

export const draftSchema = z
  .object({
    summary: z.string().max(5000).default(""),
    openQuestions: z.array(z.string().max(1000)).max(30).default([]),
    items: z
      .array(draftItemSchema)
      .max(MAX_DRAFT_ITEMS, `A breakdown can have at most ${MAX_DRAFT_ITEMS} tasks.`),
  })
  .refine((d) => new Set(d.items.map((i) => i.ref)).size === d.items.length, {
    message: "Each task needs a unique reference.",
    path: ["items"],
  });

export type Draft = z.infer<typeof draftSchema>;

export const generateInput = z.object({
  projectId: id(),
  requirement: z
    .string()
    .trim()
    .min(30, "Paste at least a couple of sentences so there's something to break down.")
    .max(
      MAX_REQUIREMENT_LENGTH,
      `Keep the requirement under ${MAX_REQUIREMENT_LENGTH.toLocaleString()} characters.`,
    ),
});

export const saveDraftInput = z.object({ id: id(), draft: draftSchema });

export const approveInput = z.object({
  id: id(),
  draft: draftSchema,
  status: z.enum(["BACKLOG", "TODO"]).default("BACKLOG"),
});

export const breakdownIdInput = z.object({ id: id() });

/** Turns Claude's output into an editable draft, dropping dangling dependency refs. */
export function toDraft(output: ClaudeBreakdown): Draft {
  const tasks = output.tasks.slice(0, MAX_DRAFT_ITEMS);
  const refs = new Set<string>();
  const items = tasks.map((t, i) => {
    let ref = t.ref.trim().slice(0, 20) || `T${i + 1}`;
    if (refs.has(ref)) ref = `T${i + 1}`;
    refs.add(ref);
    return { ...t, ref };
  });
  return {
    summary: output.summary.trim(),
    openQuestions: output.openQuestions.map((q) => q.trim()).filter(Boolean),
    items: items.map((t) => ({
      ref: t.ref,
      include: true,
      title: t.title.trim().slice(0, 200) || "Untitled task",
      description: t.description.trim().slice(0, 5000),
      priority: t.priority,
      estimateHours: Number.isFinite(t.estimateHours)
        ? Math.min(Math.max(Math.round(t.estimateHours * 4) / 4, 0), 1000)
        : null,
      assigneeId: null,
      acceptanceCriteria: t.acceptanceCriteria
        .map((c) => c.trim().slice(0, 500))
        .filter(Boolean)
        .slice(0, 30),
      dependsOn: [...new Set(t.dependsOn)].filter((r) => r !== t.ref && refs.has(r)),
    })),
  };
}

/** Returns the refs on a dependency loop among included items, or null if there is none. */
export function findCycle(items: Pick<DraftItem, "ref" | "dependsOn">[]): string[] | null {
  const deps = new Map(items.map((i) => [i.ref, i.dependsOn]));
  const state = new Map<string, "visiting" | "done">();
  const stack: string[] = [];

  const visit = (ref: string): string[] | null => {
    if (state.get(ref) === "done") return null;
    if (state.get(ref) === "visiting") return stack.slice(stack.indexOf(ref)).concat(ref);
    state.set(ref, "visiting");
    stack.push(ref);
    for (const next of deps.get(ref) ?? []) {
      if (!deps.has(next)) continue;
      const cycle = visit(next);
      if (cycle) return cycle;
    }
    stack.pop();
    state.set(ref, "done");
    return null;
  };

  for (const ref of deps.keys()) {
    const cycle = visit(ref);
    if (cycle) return cycle;
  }
  return null;
}
