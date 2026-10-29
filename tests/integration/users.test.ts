import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { canSignIn, onUserCreated } from "@/features/auth/service";
import { changeUserRole, createInvite, setUserActive } from "@/features/users/service";
import { createProject } from "@/features/projects/service";
import { projectInput } from "@/features/projects/schemas";
import { makeUser, resetDb } from "./helpers";

async function expectCode(promise: Promise<unknown>, code: AppError["code"]) {
  await expect(promise).rejects.toSatisfy((e) => e instanceof AppError && e.code === code);
}

beforeEach(resetDb);
afterAll(() => db.$disconnect());

describe("invite-only sign-in", () => {
  it("allows the bootstrap admin and invited emails only", async () => {
    process.env.ADMIN_EMAIL = "boss@team.dev";
    const admin = await makeUser("ADMIN");

    expect(await canSignIn("Boss@Team.dev")).toEqual({ ok: true });
    expect(await canSignIn("stranger@team.dev")).toEqual({ ok: false, reason: "NotInvited" });
    expect(await canSignIn(null)).toEqual({ ok: false, reason: "NoEmail" });

    await createInvite(admin, { email: "new@team.dev", role: "LEAD" });
    expect(await canSignIn("new@team.dev")).toEqual({ ok: true });
  });

  it("gives a new user their invited role and marks the invite used", async () => {
    const admin = await makeUser("ADMIN");
    await createInvite(admin, { email: "new@team.dev", role: "LEAD" });
    const user = await db.user.create({ data: { email: "new@team.dev" } });
    await onUserCreated(user.id, user.email);

    expect((await db.user.findUniqueOrThrow({ where: { id: user.id } })).role).toBe("LEAD");
    expect(
      (await db.invite.findUniqueOrThrow({ where: { email: "new@team.dev" } })).acceptedAt,
    ).not.toBeNull();
  });

  it("makes the ADMIN_EMAIL user an admin", async () => {
    process.env.ADMIN_EMAIL = "boss@team.dev";
    const user = await db.user.create({ data: { email: "boss@team.dev" } });
    await onUserCreated(user.id, user.email);
    expect((await db.user.findUniqueOrThrow({ where: { id: user.id } })).role).toBe("ADMIN");
  });

  it("blocks deactivated users and expired invites", async () => {
    const admin = await makeUser("ADMIN");
    const dev = await makeUser("DEVELOPER", "dev@team.dev");
    await setUserActive(admin, dev.id, false);
    expect(await canSignIn("dev@team.dev")).toEqual({ ok: false, reason: "Deactivated" });

    await db.invite.create({ data: { email: "late@team.dev", expiresAt: new Date(Date.now() - 1000) } });
    expect(await canSignIn("late@team.dev")).toEqual({ ok: false, reason: "NotInvited" });
  });
});

describe("user management", () => {
  it("is admin-only", async () => {
    const lead = await makeUser("LEAD");
    const dev = await makeUser("DEVELOPER");
    await expectCode(createInvite(lead, { email: "x@team.dev", role: "DEVELOPER" }), "FORBIDDEN");
    await expectCode(changeUserRole(lead, dev.id, "ADMIN"), "FORBIDDEN");
  });

  it("protects the last admin and the actor's own account", async () => {
    const admin = await makeUser("ADMIN");
    await expectCode(changeUserRole(admin, admin.id, "DEVELOPER"), "VALIDATION");
    await expectCode(setUserActive(admin, admin.id, false), "VALIDATION");
  });

  it("removes project leadership when a lead is demoted to developer", async () => {
    const admin = await makeUser("ADMIN");
    const lead = await makeUser("LEAD");
    const project = await createProject(lead, projectInput.parse({ name: "P", status: "ACTIVE" }));
    await changeUserRole(admin, lead.id, "DEVELOPER");

    expect((await db.project.findUniqueOrThrow({ where: { id: project.id } })).leadId).toBeNull();
    expect((await db.projectMember.findFirstOrThrow({ where: { userId: lead.id } })).role).toBe("MEMBER");
  });
});
