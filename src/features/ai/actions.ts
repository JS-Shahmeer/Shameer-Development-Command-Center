"use server";

import { revalidatePath } from "next/cache";
import { createAction } from "@/lib/action";
import { draftTasksWithClaude } from "./claude";
import { approveInput, breakdownIdInput, generateInput, saveDraftInput } from "./schemas";
import * as service from "./service";

export const generateBreakdownAction = createAction(generateInput, async (input, actor) => {
  const breakdown = await service.generateBreakdown(actor, input, draftTasksWithClaude);
  revalidatePath("/projects", "layout");
  return { id: breakdown.id };
});

export const saveDraftAction = createAction(saveDraftInput, async ({ id, draft }, actor) => {
  await service.saveDraft(actor, id, draft);
});

export const approveBreakdownAction = createAction(approveInput, async (input, actor) => {
  const result = await service.approveBreakdown(actor, input);
  revalidatePath("/", "layout");
  return { created: result.createdTasks };
});

export const discardBreakdownAction = createAction(breakdownIdInput, async ({ id }, actor) => {
  await service.discardBreakdown(actor, id);
  revalidatePath("/projects", "layout");
});
