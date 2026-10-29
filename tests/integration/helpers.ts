import type { Role } from "@prisma/client";
import { db } from "@/lib/db";

export async function resetDb() {
  await db.$transaction([
    db.activityLog.deleteMany(),
    db.taskComment.deleteMany(),
    db.taskDependency.deleteMany(),
    db.acceptanceCriterion.deleteMany(),
    db.task.deleteMany(),
    db.userSkill.deleteMany(),
    db.skill.deleteMany(),
    db.note.deleteMany(),
    db.projectMember.deleteMany(),
    db.project.deleteMany(),
    db.client.deleteMany(),
    db.invite.deleteMany(),
    db.account.deleteMany(),
    db.session.deleteMany(),
    db.user.deleteMany(),
  ]);
}

export async function makeUser(
  role: Role,
  email = `${role.toLowerCase()}-${Math.random().toString(36).slice(2, 8)}@test.dev`,
) {
  return db.user.create({ data: { email, name: email.split("@")[0], role } });
}
