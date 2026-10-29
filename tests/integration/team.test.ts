import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { projectInput } from "@/features/projects/schemas";
import { taskInput } from "@/features/tasks/schemas";
import { addProjectMember, createProject } from "@/features/projects/service";
import { createTask } from "@/features/tasks/service";
import { getMember, listTeam, updateProfile } from "@/features/team/service";
import { makeUser, resetDb } from "./helpers";

async function expectCode(promise: Promise<unknown>, code: AppError["code"]) {
  await expect(promise).rejects.toSatisfy((e) => e instanceof AppError && e.code === code);
}

beforeEach(resetDb);
afterAll(() => db.$disconnect());

describe("team", () => {
  it("computes workload from open estimated tasks against capacity", async () => {
    const lead = await makeUser("LEAD");
    const dev = await makeUser("DEVELOPER");
    await db.user.update({ where: { id: dev.id }, data: { capacityHours: 20 } });
    const project = await createProject(lead, projectInput.parse({ name: "P", status: "ACTIVE" }));
    await addProjectMember(lead, { projectId: project.id, userId: dev.id, role: "MEMBER" });
    for (const [estimateHours, dueDate] of [
      [8, "2000-01-01"],
      [2, null],
      [null, null],
    ] as const) {
      await createTask(lead, {
        projectId: project.id,
        status: "TODO",
        data: taskInput.parse({ title: "t", assigneeId: dev.id, estimateHours, dueDate }),
        criteria: [],
      });
    }

    const team = await listTeam(lead);
    const w = team.find((u) => u.id === dev.id)!.workload;
    expect(w).toMatchObject({
      openTasks: 3,
      openHours: 10,
      unestimated: 1,
      overdue: 1,
      capacityHours: 20,
      load: 0.5,
    });
  });

  it("limits who can see whom", async () => {
    const admin = await makeUser("ADMIN");
    const lead = await makeUser("LEAD");
    const dev = await makeUser("DEVELOPER");
    const stranger = await makeUser("DEVELOPER");
    const project = await createProject(lead, projectInput.parse({ name: "P", status: "ACTIVE" }));
    await addProjectMember(lead, { projectId: project.id, userId: dev.id, role: "MEMBER" });

    expect((await listTeam(admin)).length).toBe(4);
    expect((await listTeam(lead)).map((u) => u.id).sort()).toEqual([lead.id, dev.id].sort());
    await expectCode(listTeam(dev), "FORBIDDEN");
    await expect(getMember(dev, dev.id)).resolves.toBeTruthy();
    await expectCode(getMember(dev, stranger.id), "NOT_FOUND");
    await expectCode(getMember(lead, stranger.id), "NOT_FOUND");
  });

  it("lets people edit their own profile and skills, but not capacity", async () => {
    const dev = await makeUser("DEVELOPER");
    const other = await makeUser("DEVELOPER");
    const admin = await makeUser("ADMIN");
    const base = {
      userId: dev.id,
      name: "Dev",
      title: null,
      bio: null,
      skills: [{ name: "React", level: 4 }],
    };

    await updateProfile(dev, base);
    await expectCode(updateProfile(other, base), "FORBIDDEN");
    await expectCode(updateProfile(dev, { ...base, capacityHours: 10 }), "FORBIDDEN");
    await updateProfile(admin, { ...base, capacityHours: 10, skills: [{ name: "react", level: 5 }] });

    const user = await db.user.findUniqueOrThrow({
      where: { id: dev.id },
      include: { skills: { include: { skill: true } } },
    });
    expect(user.capacityHours).toBe(10);
    // "react" reuses the existing "React" skill instead of creating a duplicate.
    expect(user.skills.map((s) => [s.skill.name, s.level])).toEqual([["React", 5]]);
    expect(await db.skill.count()).toBe(1);
  });
});
