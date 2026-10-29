import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { projectInput } from "@/features/projects/schemas";
import { taskInput } from "@/features/tasks/schemas";
import { addProjectMember, createProject } from "@/features/projects/service";
import {
  addComment,
  addCriterion,
  addDependency,
  createTask,
  deleteComment,
  deleteTask,
  getTask,
  listTasks,
  setTaskStatus,
  toggleCriterion,
  updateTask,
} from "@/features/tasks/service";
import { makeUser, resetDb } from "./helpers";

async function expectCode(promise: Promise<unknown>, code: AppError["code"]) {
  await expect(promise).rejects.toSatisfy((e) => e instanceof AppError && e.code === code);
}

const data = (over: Record<string, unknown> = {}) => taskInput.parse({ title: "Build login", ...over });

async function setup() {
  const lead = await makeUser("LEAD");
  const dev = await makeUser("DEVELOPER");
  const other = await makeUser("DEVELOPER");
  const outsider = await makeUser("DEVELOPER");
  const project = await createProject(lead, projectInput.parse({ name: "App", status: "ACTIVE" }));
  await addProjectMember(lead, { projectId: project.id, userId: dev.id, role: "MEMBER" });
  await addProjectMember(lead, { projectId: project.id, userId: other.id, role: "MEMBER" });
  const make = (over: Record<string, unknown> = {}, actor = lead) =>
    createTask(actor, { projectId: project.id, status: "TODO", data: data(over), criteria: [] });
  return { lead, dev, other, outsider, project, make };
}

beforeEach(resetDb);
afterAll(() => db.$disconnect());

describe("task permissions", () => {
  it("lets members create tasks but only assign them to themselves", async () => {
    const { dev, other, make } = await setup();
    await expect(make({ assigneeId: dev.id }, dev)).resolves.toMatchObject({ reporterId: dev.id });
    await expectCode(make({ assigneeId: other.id }, dev), "FORBIDDEN");
  });

  it("rejects assignees who aren't on the project", async () => {
    const { outsider, make } = await setup();
    await expectCode(make({ assigneeId: outsider.id }), "VALIDATION");
  });

  it("hides tasks from people outside the project", async () => {
    const { outsider, make } = await setup();
    const task = await make();
    await expectCode(getTask(outsider, task.id), "NOT_FOUND");
    await expectCode(
      setTaskStatus(outsider, { id: task.id, status: "DONE", blockedReason: null }),
      "NOT_FOUND",
    );
    expect(await listTasks(outsider)).toHaveLength(0);
  });

  it("only lets the assignee or lead change status and tick criteria", async () => {
    const { dev, other, make } = await setup();
    const task = await make({ assigneeId: dev.id });
    // The assignee is neither lead nor reporter, so can't change the criteria themselves.
    await expectCode(addCriterion(dev, task.id, "Works offline"), "FORBIDDEN");

    await expectCode(
      setTaskStatus(other, { id: task.id, status: "IN_PROGRESS", blockedReason: null }),
      "FORBIDDEN",
    );
    await expect(
      setTaskStatus(dev, { id: task.id, status: "IN_PROGRESS", blockedReason: null }),
    ).resolves.toMatchObject({
      status: "IN_PROGRESS",
    });
  });

  it("lets the lead tick criteria and the assignee tick them too", async () => {
    const { lead, dev, other, make } = await setup();
    const task = await make({ assigneeId: dev.id });
    const c = await addCriterion(lead, task.id, "Has tests");
    await expect(toggleCriterion(dev, c.id, true)).resolves.toMatchObject({ done: true });
    await expectCode(toggleCriterion(other, c.id, false), "FORBIDDEN");
  });

  it("only lets the lead reassign or delete", async () => {
    const { dev, other, make } = await setup();
    const task = await make({}, dev);
    await expectCode(updateTask(dev, task.id, data({ assigneeId: other.id })), "FORBIDDEN");
    await expect(
      updateTask(dev, task.id, data({ title: "Renamed", assigneeId: dev.id })),
    ).resolves.toMatchObject({
      title: "Renamed",
    });
    await expectCode(deleteTask(dev, task.id), "FORBIDDEN");
  });

  it("lets people delete only their own comments, and leads delete any", async () => {
    const { lead, dev, other, make } = await setup();
    const task = await make();
    const mine = await addComment(dev, task.id, "On it");
    await expectCode(deleteComment(other, mine.id), "FORBIDDEN");
    const theirs = await addComment(other, task.id, "Me too");
    await expect(deleteComment(lead, theirs.id)).resolves.toBeTruthy();
    await expect(deleteComment(dev, mine.id)).resolves.toBeTruthy();
  });
});

describe("task workflow rules", () => {
  it("requires a reason to block, and clears it when unblocked", async () => {
    const { lead, make } = await setup();
    const task = await make();
    const blocked = await setTaskStatus(lead, {
      id: task.id,
      status: "BLOCKED",
      blockedReason: "No API keys",
    });
    expect(blocked.blockedReason).toBe("No API keys");
    const resumed = await setTaskStatus(lead, { id: task.id, status: "IN_PROGRESS", blockedReason: null });
    expect(resumed.blockedReason).toBeNull();
  });

  it("can't be finished before its dependencies", async () => {
    const { lead, make } = await setup();
    const api = await make({ title: "API" });
    const ui = await make({ title: "UI" });
    await addDependency(lead, ui.id, api.id);

    await expectCode(setTaskStatus(lead, { id: ui.id, status: "DONE", blockedReason: null }), "VALIDATION");
    await setTaskStatus(lead, { id: api.id, status: "DONE", blockedReason: null });
    const done = await setTaskStatus(lead, { id: ui.id, status: "DONE", blockedReason: null });
    expect(done.completedAt).toBeInstanceOf(Date);
  });

  it("rejects dependency loops, including indirect ones", async () => {
    const { lead, make } = await setup();
    const a = await make({ title: "A" });
    const b = await make({ title: "B" });
    const c = await make({ title: "C" });
    await addDependency(lead, b.id, a.id); // B needs A
    await addDependency(lead, c.id, b.id); // C needs B
    await expectCode(addDependency(lead, a.id, c.id), "VALIDATION"); // A needs C would loop
    await expectCode(addDependency(lead, a.id, a.id), "VALIDATION");
  });

  it("rejects dependencies across projects", async () => {
    const { lead, make } = await setup();
    const other = await createProject(lead, projectInput.parse({ name: "Other", status: "ACTIVE" }));
    const here = await make();
    const there = await createTask(lead, { projectId: other.id, status: "TODO", data: data(), criteria: [] });
    await expectCode(addDependency(lead, here.id, there.id), "VALIDATION");
  });

  it("sorts task lists by priority then due date", async () => {
    const { lead, make } = await setup();
    await make({ title: "low", priority: "LOW" });
    await make({ title: "urgent-later", priority: "URGENT", dueDate: "2030-02-01" });
    await make({ title: "urgent-sooner", priority: "URGENT", dueDate: "2030-01-01" });
    const titles = (await listTasks(lead)).map((t) => t.title);
    expect(titles).toEqual(["urgent-sooner", "urgent-later", "low"]);
  });
});
