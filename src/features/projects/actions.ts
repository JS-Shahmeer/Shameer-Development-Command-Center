"use server";

import { revalidatePath } from "next/cache";
import { createAction } from "@/lib/action";
import {
  archiveProjectInput,
  memberInput,
  projectInput,
  removeMemberInput,
  updateProjectInput,
} from "./schemas";
import * as service from "./service";

export const createProjectAction = createAction(projectInput, async (input, actor) => {
  const project = await service.createProject(actor, input);
  revalidatePath("/projects");
  revalidatePath("/dashboard");
  return { slug: project.slug };
});

export const updateProjectAction = createAction(updateProjectInput, async ({ id, data }, actor) => {
  const project = await service.updateProject(actor, id, data);
  revalidatePath("/projects");
  revalidatePath(`/projects/${project.slug}`);
  revalidatePath("/dashboard");
  return { slug: project.slug };
});

export const archiveProjectAction = createAction(archiveProjectInput, async ({ id, archived }, actor) => {
  const project = await service.setProjectArchived(actor, id, archived);
  revalidatePath("/projects");
  revalidatePath(`/projects/${project.slug}`);
  revalidatePath("/dashboard");
});

export const addMemberAction = createAction(memberInput, async (input, actor) => {
  await service.addProjectMember(actor, input);
  revalidatePath("/projects", "layout");
});

export const removeMemberAction = createAction(removeMemberInput, async (input, actor) => {
  await service.removeProjectMember(actor, input);
  revalidatePath("/projects", "layout");
});
