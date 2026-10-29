import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { projectInput } from "@/features/projects/schemas";
import {
  addProjectMember,
  createProject,
  getProjectBySlug,
  listProjects,
  setProjectArchived,
  updateProject,
} from "@/features/projects/service";
import { createNote, deleteNote, updateNote } from "@/features/notes/service";
import { makeUser, resetDb } from "./helpers";

const input = (over: Record<string, unknown> = {}) =>
  projectInput.parse({ name: "Storefront", status: "ACTIVE", ...over });

async function expectCode(promise: Promise<unknown>, code: AppError["code"]) {
  await expect(promise).rejects.toSatisfy((e) => e instanceof AppError && e.code === code);
}

beforeEach(resetDb);
afterAll(() => db.$disconnect());

describe("projects service", () => {
  it("makes a lead the lead of the project they create, with a unique slug", async () => {
    const lead = await makeUser("LEAD");
    const a = await createProject(lead, input());
    const b = await createProject(lead, input());
    expect(a.leadId).toBe(lead.id);
    expect([a.slug, b.slug]).toEqual(["storefront", "storefront-2"]);
    const members = await db.projectMember.findMany({ where: { projectId: a.id } });
    expect(members).toMatchObject([{ userId: lead.id, role: "LEAD" }]);
    expect(await db.activityLog.count({ where: { action: "project.created" } })).toBe(2);
  });

  it("forbids developers from creating projects", async () => {
    const dev = await makeUser("DEVELOPER");
    await expectCode(createProject(dev, input()), "FORBIDDEN");
  });

  it("rejects a developer as project lead", async () => {
    const admin = await makeUser("ADMIN");
    const dev = await makeUser("DEVELOPER");
    await expectCode(createProject(admin, input({ leadId: dev.id })), "VALIDATION");
  });

  it("only shows developers the projects they belong to", async () => {
    const lead = await makeUser("LEAD");
    const dev = await makeUser("DEVELOPER");
    const mine = await createProject(lead, input({ name: "Mine" }));
    await createProject(lead, input({ name: "Not mine" }));
    await addProjectMember(lead, { projectId: mine.id, userId: dev.id, role: "MEMBER" });

    const visible = await listProjects(dev);
    expect(visible.map((p) => p.name)).toEqual(["Mine"]);
    await expectCode(getProjectBySlug(dev, "not-mine"), "NOT_FOUND");
  });

  it("returns forbidden when a member calls an edit action directly", async () => {
    const lead = await makeUser("LEAD");
    const dev = await makeUser("DEVELOPER");
    const project = await createProject(lead, input());
    await addProjectMember(lead, { projectId: project.id, userId: dev.id, role: "MEMBER" });

    await expectCode(updateProject(dev, project.id, input({ name: "Hacked" })), "FORBIDDEN");
    await expectCode(setProjectArchived(dev, project.id, true), "FORBIDDEN");
    expect((await db.project.findUniqueOrThrow({ where: { id: project.id } })).name).toBe("Storefront");
  });

  it("hides a project from a lead who doesn't run it", async () => {
    const lead = await makeUser("LEAD");
    const otherLead = await makeUser("LEAD");
    const project = await createProject(lead, input());
    await expectCode(updateProject(otherLead, project.id, input()), "NOT_FOUND");
  });

  it("moves the lead membership when the lead changes", async () => {
    const admin = await makeUser("ADMIN");
    const first = await makeUser("LEAD");
    const second = await makeUser("LEAD");
    const project = await createProject(admin, input({ leadId: first.id }));
    await updateProject(admin, project.id, input({ leadId: second.id }));

    const members = await db.projectMember.findMany({
      where: { projectId: project.id },
      orderBy: { role: "asc" },
    });
    expect(members.map((m) => [m.userId, m.role])).toEqual(
      expect.arrayContaining([
        [second.id, "LEAD"],
        [first.id, "MEMBER"],
      ]),
    );
  });

  it("archives and restores without deleting", async () => {
    const lead = await makeUser("LEAD");
    const project = await createProject(lead, input());
    await setProjectArchived(lead, project.id, true);
    expect(await listProjects(lead)).toHaveLength(0);
    expect(await listProjects(lead, { archived: true })).toHaveLength(1);
    await setProjectArchived(lead, project.id, false);
    expect(await listProjects(lead)).toHaveLength(1);
  });
});

describe("notes service", () => {
  it("lets members write notes but only edit their own", async () => {
    const lead = await makeUser("LEAD");
    const dev = await makeUser("DEVELOPER");
    const outsider = await makeUser("DEVELOPER");
    const project = await createProject(lead, input());
    await addProjectMember(lead, { projectId: project.id, userId: dev.id, role: "MEMBER" });

    const leadNote = await createNote(lead, project.id, { title: "Deploy", body: "Steps", pinned: false });
    const devNote = await createNote(dev, project.id, { title: "Mine", body: "Text", pinned: false });

    await expectCode(updateNote(dev, leadNote.id, { title: "x", body: "y", pinned: false }), "FORBIDDEN");
    await expect(
      updateNote(dev, devNote.id, { title: "Mine 2", body: "Text", pinned: true }),
    ).resolves.toMatchObject({ pinned: true });
    await expectCode(createNote(outsider, project.id, { title: "x", body: "y", pinned: false }), "NOT_FOUND");
    await expect(deleteNote(lead, devNote.id)).resolves.toBeTruthy();
  });
});
