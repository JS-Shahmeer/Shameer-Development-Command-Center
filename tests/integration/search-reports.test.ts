import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { projectInput } from "@/features/projects/schemas";
import { taskInput } from "@/features/tasks/schemas";
import { addProjectMember, createProject } from "@/features/projects/service";
import { createTask, setTaskStatus } from "@/features/tasks/service";
import { globalSearch, snippet } from "@/features/search/service";
import { getReport, parseDay, reportRange, reportToMarkdown, toDayString } from "@/features/reports/service";
import { makeUser, resetDb } from "./helpers";

async function setup() {
  const admin = await makeUser("ADMIN");
  const lead = await makeUser("LEAD");
  const dev = await makeUser("DEVELOPER");
  const outsider = await makeUser("DEVELOPER");
  const client = await db.client.create({ data: { name: "Kestrel Foods" } });
  const project = await createProject(
    lead,
    projectInput.parse({ name: "Kestrel storefront", status: "ACTIVE", clientId: client.id }),
  );
  await addProjectMember(lead, { projectId: project.id, userId: dev.id, role: "MEMBER" });
  const task = await createTask(lead, {
    projectId: project.id,
    status: "TODO",
    data: taskInput.parse({ title: "Checkout flow", description: "Stripe checkout for kestrel orders" }),
    criteria: [],
  });
  return { admin, lead, dev, outsider, project, task };
}

beforeEach(resetDb);
afterAll(() => db.$disconnect());

describe("global search", () => {
  it("finds projects and tasks the actor can see, case-insensitively", async () => {
    const { dev } = await setup();
    const result = await globalSearch(dev, "KESTREL");
    expect(result!.projects.map((p) => p.name)).toEqual(["Kestrel storefront"]);
    expect(result!.tasks.map((t) => t.title)).toEqual(["Checkout flow"]);
    expect(result!.tasks[0]!.snippet).toContain("kestrel");
  });

  it("returns nothing from projects the actor isn't on", async () => {
    const { outsider } = await setup();
    const result = await globalSearch(outsider, "kestrel");
    expect(result!.projects).toHaveLength(0);
    expect(result!.tasks).toHaveLength(0);
  });

  it("only shows clients to admins and leads", async () => {
    const { admin, dev } = await setup();
    expect((await globalSearch(admin, "foods"))!.clients).toHaveLength(1);
    expect((await globalSearch(dev, "foods"))!.clients).toHaveLength(0);
  });

  it("ignores queries shorter than two characters", async () => {
    const { admin } = await setup();
    expect(await globalSearch(admin, " k ")).toBeNull();
  });

  it("builds snippets around the match", () => {
    expect(snippet("a ".repeat(100) + "needle" + " b".repeat(100), "needle", 10)).toMatch(/^….*needle.*…$/);
  });
});

describe("reports", () => {
  it("uses Monday to Sunday weeks in UTC", () => {
    const { start, end } = reportRange("weekly", parseDay("2026-10-29")); // a Thursday
    expect(toDayString(start)).toBe("2026-10-26");
    expect(toDayString(end)).toBe("2026-11-02");
    expect(toDayString(parseDay("not-a-date"))).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("counts tasks completed and started in the period", async () => {
    const { lead, task, project } = await setup();
    await setTaskStatus(lead, { id: task.id, status: "IN_PROGRESS", blockedReason: null });
    await setTaskStatus(lead, { id: task.id, status: "DONE", blockedReason: null });
    const report = await getReport(lead, { period: "daily", day: parseDay(toDayString(new Date())) });
    expect(report.summary).toMatchObject({ completed: 1, created: 1, started: 1 });
    expect(report.projects.find((p) => p.id === project.id)).toMatchObject({ done: 1, total: 1 });
    expect(reportToMarkdown(report, "All projects")).toContain("- Checkout flow (Kestrel storefront");
  });

  it("lists overdue and blocked work", async () => {
    const { lead, project } = await setup();
    const late = await createTask(lead, {
      projectId: project.id,
      status: "TODO",
      data: taskInput.parse({ title: "Late", dueDate: "2020-01-01" }),
      criteria: [],
    });
    await setTaskStatus(lead, { id: late.id, status: "BLOCKED", blockedReason: "Waiting on API keys" });
    const report = await getReport(lead, { period: "weekly", day: parseDay(undefined) });
    expect(report.overdue.map((t) => t.title)).toContain("Late");
    expect(report.blocked.map((t) => t.blockedReason)).toEqual(["Waiting on API keys"]);
  });

  it("hides other people's projects", async () => {
    const { outsider, project } = await setup();
    const report = await getReport(outsider, { period: "weekly", day: parseDay(undefined) });
    expect(report.summary.created).toBe(0);
    await expect(
      getReport(outsider, { period: "weekly", day: parseDay(undefined), projectId: project.id }),
    ).rejects.toSatisfy((e) => e instanceof AppError && e.code === "NOT_FOUND");
  });
});
