import { z } from "zod";
import { id, optionalDate, optionalId, optionalText, requiredText } from "@/lib/validation";

export const TASK_STATUSES = ["BACKLOG", "TODO", "IN_PROGRESS", "IN_REVIEW", "BLOCKED", "DONE"] as const;
export const TASK_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;

export type TaskStatusValue = (typeof TASK_STATUSES)[number];
export type TaskPriorityValue = (typeof TASK_PRIORITIES)[number];

export const taskStatusLabel: Record<TaskStatusValue, string> = {
  BACKLOG: "Backlog",
  TODO: "To do",
  IN_PROGRESS: "In progress",
  IN_REVIEW: "In review",
  BLOCKED: "Blocked",
  DONE: "Done",
};

export const taskPriorityLabel: Record<TaskPriorityValue, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  URGENT: "Urgent",
};

const estimate = z
  .union([z.number(), z.string()])
  .optional()
  .nullable()
  .transform((v, ctx) => {
    if (v === null || v === undefined || v === "") return null;
    const n = typeof v === "number" ? v : Number(v);
    if (!Number.isFinite(n) || n < 0 || n > 1000) {
      ctx.addIssue({ code: "custom", message: "Enter hours between 0 and 1000." });
      return z.NEVER;
    }
    return Math.round(n * 4) / 4;
  });

export const criterionText = z
  .string()
  .trim()
  .min(1, "Criterion can't be empty.")
  .max(500, "Keep each criterion under 500 characters.");

export const taskInput = z.object({
  title: requiredText("Title", 200),
  description: optionalText(20000),
  priority: z.enum(TASK_PRIORITIES, { error: "Choose a priority." }).default("MEDIUM"),
  assigneeId: optionalId(),
  dueDate: optionalDate(),
  estimateHours: estimate,
});

export type TaskInput = z.infer<typeof taskInput>;
export type TaskFormValues = z.input<typeof taskInput>;

export const createTaskInput = z.object({
  projectId: id(),
  status: z.enum(TASK_STATUSES).default("TODO"),
  data: taskInput,
  criteria: z.array(criterionText).max(30, "Add at most 30 criteria.").default([]),
});

export const updateTaskInput = z.object({ id: id(), data: taskInput });

export const statusInput = z
  .object({
    id: id(),
    status: z.enum(TASK_STATUSES),
    blockedReason: optionalText(2000),
  })
  .refine((v) => v.status !== "BLOCKED" || Boolean(v.blockedReason), {
    message: "Say what is blocking this task.",
    path: ["blockedReason"],
  });

export const taskIdInput = z.object({ id: id() });

export const addCriterionInput = z.object({ taskId: id(), text: criterionText });
export const toggleCriterionInput = z.object({ id: id(), done: z.boolean() });
export const criterionIdInput = z.object({ id: id() });

export const dependencyInput = z.object({ taskId: id(), dependsOnId: id() });

export const commentInput = z.object({
  taskId: id(),
  body: requiredText("Comment", 10000),
});
export const commentIdInput = z.object({ id: id() });

export const taskListFilter = z.object({
  q: z.string().trim().max(100).optional(),
  status: z.enum(TASK_STATUSES).optional(),
  priority: z.enum(TASK_PRIORITIES).optional(),
  assigneeId: z.string().optional(),
  projectId: z.string().optional(),
  open: z.boolean().optional(),
});
