import { describe, expect, it } from "vitest";
import { can, visibleProjectsWhere, type Actor, type ProjectAccess } from "@/lib/permissions";

const admin: Actor = { id: "admin", role: "ADMIN" };
const lead: Actor = { id: "lead", role: "LEAD" };
const otherLead: Actor = { id: "other-lead", role: "LEAD" };
const dev: Actor = { id: "dev", role: "DEVELOPER" };
const outsider: Actor = { id: "outsider", role: "DEVELOPER" };

const project: ProjectAccess = {
  leadId: "lead",
  members: [
    { userId: "lead", role: "LEAD" },
    { userId: "dev", role: "MEMBER" },
  ],
};

describe("project permissions", () => {
  it("lets admins do everything", () => {
    expect(can.viewProject(admin, project)).toBe(true);
    expect(can.editProject(admin, project)).toBe(true);
    expect(can.manageMembers(admin, project)).toBe(true);
  });

  it("lets the project lead edit their own project only", () => {
    expect(can.editProject(lead, project)).toBe(true);
    expect(can.editProject(otherLead, project)).toBe(false);
    expect(can.viewProject(otherLead, project)).toBe(false);
  });

  it("lets members view but not edit", () => {
    expect(can.viewProject(dev, project)).toBe(true);
    expect(can.editProject(dev, project)).toBe(false);
    expect(can.manageMembers(dev, project)).toBe(false);
  });

  it("never lets a developer edit, even when marked as a co-lead", () => {
    const p: ProjectAccess = { leadId: null, members: [{ userId: "dev", role: "LEAD" }] };
    expect(can.editProject(dev, p)).toBe(false);
  });

  it("hides projects from non-members", () => {
    expect(can.viewProject(outsider, project)).toBe(false);
    expect(can.createNote(outsider, project)).toBe(false);
  });

  it("only allows admins and leads to create projects and manage clients", () => {
    expect(can.createProject(admin)).toBe(true);
    expect(can.createProject(lead)).toBe(true);
    expect(can.createProject(dev)).toBe(false);
    expect(can.manageClients(dev)).toBe(false);
    expect(can.deleteClient(lead)).toBe(false);
    expect(can.deleteClient(admin)).toBe(true);
  });

  it("only allows admins to manage users", () => {
    expect(can.manageUsers(admin)).toBe(true);
    expect(can.manageUsers(lead)).toBe(false);
    expect(can.manageUsers(dev)).toBe(false);
  });
});

describe("note permissions", () => {
  it("lets authors edit their own notes, and leads edit any", () => {
    expect(can.editNote(dev, project, { authorId: "dev" })).toBe(true);
    expect(can.editNote(dev, project, { authorId: "lead" })).toBe(false);
    expect(can.editNote(lead, project, { authorId: "dev" })).toBe(true);
  });

  it("revokes note editing when the author leaves the project", () => {
    expect(can.editNote(outsider, project, { authorId: "outsider" })).toBe(false);
  });
});

describe("visibleProjectsWhere", () => {
  it("has no filter for admins and a membership filter for others", () => {
    expect(visibleProjectsWhere(admin)).toEqual({});
    expect(visibleProjectsWhere(dev)).toEqual({
      OR: [{ leadId: "dev" }, { members: { some: { userId: "dev" } } }],
    });
  });
});
