import { db } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { forbidden, notFound } from "@/lib/errors";
import { can, type Actor } from "@/lib/permissions";
import { requireProjectView } from "@/features/projects/service";
import type { NoteInput } from "./schemas";

async function requireNoteEdit(actor: Actor, noteId: string) {
  const note = await db.note.findUnique({ where: { id: noteId } });
  if (!note) throw notFound("Note");
  const project = await requireProjectView(actor, note.projectId);
  if (!can.editNote(actor, project, note)) {
    throw forbidden("Only the note's author or the project lead can change this note.");
  }
  return { note, project };
}

export async function createNote(actor: Actor, projectId: string, input: NoteInput) {
  const project = await requireProjectView(actor, projectId);
  if (!can.createNote(actor, project)) throw forbidden();
  return db.$transaction(async (tx) => {
    const note = await tx.note.create({ data: { ...input, projectId, authorId: actor.id } });
    await logActivity(tx, {
      actorId: actor.id,
      action: "note.created",
      entityType: "Note",
      entityId: note.id,
      projectId,
      summary: `added note "${note.title}" to ${project.name}`,
    });
    return note;
  });
}

export async function updateNote(actor: Actor, noteId: string, input: NoteInput) {
  const { project } = await requireNoteEdit(actor, noteId);
  return db.$transaction(async (tx) => {
    const note = await tx.note.update({ where: { id: noteId }, data: input });
    await logActivity(tx, {
      actorId: actor.id,
      action: "note.updated",
      entityType: "Note",
      entityId: note.id,
      projectId: note.projectId,
      summary: `edited note "${note.title}" in ${project.name}`,
    });
    return note;
  });
}

export async function setNotePinned(actor: Actor, noteId: string, pinned: boolean) {
  await requireNoteEdit(actor, noteId);
  return db.note.update({ where: { id: noteId }, data: { pinned } });
}

export async function deleteNote(actor: Actor, noteId: string) {
  const { note, project } = await requireNoteEdit(actor, noteId);
  await db.$transaction(async (tx) => {
    await tx.note.delete({ where: { id: noteId } });
    await logActivity(tx, {
      actorId: actor.id,
      action: "note.deleted",
      entityType: "Note",
      entityId: noteId,
      projectId: note.projectId,
      summary: `deleted note "${note.title}" from ${project.name}`,
    });
  });
  return note;
}
