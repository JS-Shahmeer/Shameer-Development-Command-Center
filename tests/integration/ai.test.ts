import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { projectInput } from "@/features/projects/schemas";
import { addProjectMember, createProject } from "@/features/projects/service";
import {
  approveBreakdown,
  discardBreakdown,
  generateBreakdown,
  getBreakdown,
  HOURLY_LIMIT,
  saveDraft,
} from "@/features/ai/service";
import type { BreakdownGenerator } from "@/features/ai/claude";
import type { Draft } from "@/features/ai/schemas";
import { makeUser, resetDb } from "./helpers";

async function expectCode(promise: Promise<unknown>, code: AppError["code"]) {
  await expect(promise).rejects.toSatisfy((e) => e instanceof AppError && e.code === code);
}

const requirement = "Customers need to reset their password by email from the login page.";

const fakeClaude: BreakdownGenerator = async () => ({
  model: "test-model",
  inputTokens: 100,
  outputTokens: 200,
  output: {
    summary: "Password reset by email.",
    openQuestions: ["How long should links stay valid?"],
    tasks: [
      {
        ref: "T1",
        title: "Add reset token table",
        description: "Store hashed tokens with expiry.",
        priority: "HIGH",
        estimateHours: 2,
        acceptanceCriteria: ["Tokens expire", "Tokens are hashed"],
        dependsOn: [],
      },
      {
        ref: "T2",
        title: "Send reset email",
        description: "",
        priority: "MEDIUM",
        estimateHours: 3,
        acceptanceCriteria: ["Email contains a link"],
        dependsOn: ["T1"],
      },
      {
        ref: "T3",
        title: "Reset form",
        description: "",
        priority: "MEDIUM",
        estimateHours: 4,
        acceptanceCriteria: [],
        dependsOn: ["T1", "T2"],
      },
    ],
  },
});

async function setup() {
  const lead = await makeUser("LEAD");
  const dev = await makeUser("DEVELOPER");
  const outsider = await makeUser("DEVELOPER");
  const project = await createProject(lead, projectInput.parse({ name: "Shop", status: "ACTIVE" }));
  await addProjectMember(lead, { projectId: project.id, userId: dev.id, role: "MEMBER" });
  const breakdown = await generateBreakdown(lead, { projectId: project.id, requirement }, fakeClaude);
  const { breakdown: loaded } = await getBreakdown(lead, breakdown.id);
  return { lead, dev, outsider, project, id: breakdown.id, draft: loaded.draft };
}

beforeEach(resetDb);
afterAll(() => db.$disconnect());

describe("AI breakdown permissions", () => {
  it("only lets admins and the project lead generate", async () => {
    const { dev, outsider, project } = await setup();
    const generate = vi.fn(fakeClaude);
    await expectCode(generateBreakdown(dev, { projectId: project.id, requirement }, generate), "FORBIDDEN");
    await expectCode(
      generateBreakdown(outsider, { projectId: project.id, requirement }, generate),
      "NOT_FOUND",
    );
    expect(generate).not.toHaveBeenCalled();
  });

  it("hides drafts from members who can't manage tasks", async () => {
    const { dev, id } = await setup();
    await expectCode(getBreakdown(dev, id), "NOT_FOUND");
  });

  it("enforces the hourly limit per person", async () => {
    const { lead, project } = await setup();
    await db.aiBreakdown.createMany({
      data: Array.from({ length: HOURLY_LIMIT - 1 }, () => ({
        projectId: project.id,
        createdById: lead.id,
        requirement,
        model: "test-model",
        draft: {},
      })),
    });
    const generate = vi.fn(fakeClaude);
    await expectCode(generateBreakdown(lead, { projectId: project.id, requirement }, generate), "CONFLICT");
    expect(generate).not.toHaveBeenCalled();
  });
});

describe("generate and approve", () => {
  it("stores a draft without creating tasks", async () => {
    const { project, draft } = await setup();
    expect(draft.items).toHaveLength(3);
    expect(await db.task.count({ where: { projectId: project.id } })).toBe(0);
  });

  it("creates the included tasks with criteria and dependencies", async () => {
    const { lead, dev, project, id, draft } = await setup();
    const edited: Draft = {
      ...draft,
      items: draft.items.map((i) => (i.ref === "T2" ? { ...i, title: "Send email", assigneeId: dev.id } : i)),
    };
    await approveBreakdown(lead, { id, draft: edited, status: "TODO" });

    const tasks = await db.task.findMany({
      where: { projectId: project.id },
      include: { criteria: true, dependsOn: true },
      orderBy: { position: "asc" },
    });
    expect(tasks.map((t) => t.title)).toEqual(["Add reset token table", "Send email", "Reset form"]);
    expect(tasks.every((t) => t.status === "TODO" && t.reporterId === lead.id)).toBe(true);
    expect(tasks[1]!.assigneeId).toBe(dev.id);
    expect(tasks[0]!.criteria.map((c) => c.text)).toEqual(["Tokens expire", "Tokens are hashed"]);
    expect(tasks[2]!.dependsOn.map((d) => d.dependsOnId).sort()).toEqual([tasks[0]!.id, tasks[1]!.id].sort());

    const saved = await db.aiBreakdown.findUniqueOrThrow({ where: { id } });
    expect(saved).toMatchObject({ status: "APPROVED", createdTasks: 3, approvedById: lead.id });
    await expectCode(approveBreakdown(lead, { id, draft: edited, status: "TODO" }), "CONFLICT");
  });

  it("rejects a dependency on a task that isn't included", async () => {
    const { lead, project, id, draft } = await setup();
    const edited = { ...draft, items: draft.items.map((i) => ({ ...i, include: i.ref !== "T1" })) };
    await expectCode(approveBreakdown(lead, { id, draft: edited, status: "BACKLOG" }), "VALIDATION");
    expect(await db.task.count({ where: { projectId: project.id } })).toBe(0);
  });

  it("rejects dependency loops", async () => {
    const { lead, id, draft } = await setup();
    const edited = {
      ...draft,
      items: draft.items.map((i) => (i.ref === "T1" ? { ...i, dependsOn: ["T3"] } : i)),
    };
    await expectCode(approveBreakdown(lead, { id, draft: edited, status: "BACKLOG" }), "VALIDATION");
  });

  it("only assigns to project members", async () => {
    const { lead, outsider, id, draft } = await setup();
    const edited = { ...draft, items: draft.items.map((i) => ({ ...i, assigneeId: outsider.id })) };
    await expectCode(approveBreakdown(lead, { id, draft: edited, status: "BACKLOG" }), "VALIDATION");
  });

  it("saves edits and locks the draft once discarded", async () => {
    const { lead, id, draft } = await setup();
    await saveDraft(lead, id, { ...draft, items: draft.items.slice(0, 1) });
    expect((await getBreakdown(lead, id)).breakdown.draft.items).toHaveLength(1);
    await discardBreakdown(lead, id);
    await expectCode(saveDraft(lead, id, draft), "CONFLICT");
  });
});
