"use server";

import { revalidatePath } from "next/cache";
import { createAction } from "@/lib/action";
import { createNoteInput, noteIdInput, pinNoteInput, updateNoteInput } from "./schemas";
import * as service from "./service";

const refresh = () => revalidatePath("/projects", "layout");

export const createNoteAction = createAction(createNoteInput, async ({ projectId, data }, actor) => {
  await service.createNote(actor, projectId, data);
  refresh();
});

export const updateNoteAction = createAction(updateNoteInput, async ({ id, data }, actor) => {
  await service.updateNote(actor, id, data);
  refresh();
});

export const pinNoteAction = createAction(pinNoteInput, async ({ id, pinned }, actor) => {
  await service.setNotePinned(actor, id, pinned);
  refresh();
});

export const deleteNoteAction = createAction(noteIdInput, async ({ id }, actor) => {
  await service.deleteNote(actor, id);
  refresh();
});
