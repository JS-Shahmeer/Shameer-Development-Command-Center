import { z } from "zod";
import { id, requiredText } from "@/lib/validation";

export const noteInput = z.object({
  title: requiredText("Title", 160),
  body: requiredText("Note", 20000),
  pinned: z.boolean().default(false),
});

export type NoteInput = z.infer<typeof noteInput>;

export const createNoteInput = z.object({ projectId: id(), data: noteInput });
export const updateNoteInput = z.object({ id: id(), data: noteInput });
export const noteIdInput = z.object({ id: id() });
export const pinNoteInput = z.object({ id: id(), pinned: z.boolean() });
