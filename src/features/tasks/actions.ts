"use server";

import { revalidatePath } from "next/cache";
import { createAction } from "@/lib/action";
import {
  addCriterionInput,
  commentIdInput,
  commentInput,
  createTaskInput,
  criterionIdInput,
  dependencyInput,
  statusInput,
  taskIdInput,
  toggleCriterionInput,
  updateTaskInput,
} from "./schemas";
import * as service from "./service";

// Tasks show up on project pages, task pages, My tasks, team profiles and the dashboard.
const refresh = () => {
  revalidatePath("/", "layout");
};

export const createTaskAction = createAction(createTaskInput, async (input, actor) => {
  const task = await service.createTask(actor, input);
  refresh();
  return { id: task.id };
});

export const updateTaskAction = createAction(updateTaskInput, async ({ id, data }, actor) => {
  await service.updateTask(actor, id, data);
  refresh();
});

export const setTaskStatusAction = createAction(statusInput, async (input, actor) => {
  await service.setTaskStatus(actor, input);
  refresh();
});

export const deleteTaskAction = createAction(taskIdInput, async ({ id }, actor) => {
  const { project } = await service.deleteTask(actor, id);
  refresh();
  return { projectId: project.id };
});

export const addCriterionAction = createAction(addCriterionInput, async ({ taskId, text }, actor) => {
  await service.addCriterion(actor, taskId, text);
  refresh();
});

export const toggleCriterionAction = createAction(toggleCriterionInput, async ({ id, done }, actor) => {
  await service.toggleCriterion(actor, id, done);
  refresh();
});

export const deleteCriterionAction = createAction(criterionIdInput, async ({ id }, actor) => {
  await service.deleteCriterion(actor, id);
  refresh();
});

export const addDependencyAction = createAction(dependencyInput, async ({ taskId, dependsOnId }, actor) => {
  await service.addDependency(actor, taskId, dependsOnId);
  refresh();
});

export const removeDependencyAction = createAction(
  dependencyInput,
  async ({ taskId, dependsOnId }, actor) => {
    await service.removeDependency(actor, taskId, dependsOnId);
    refresh();
  },
);

export const addCommentAction = createAction(commentInput, async ({ taskId, body }, actor) => {
  await service.addComment(actor, taskId, body);
  refresh();
});

export const deleteCommentAction = createAction(commentIdInput, async ({ id }, actor) => {
  await service.deleteComment(actor, id);
  refresh();
});
