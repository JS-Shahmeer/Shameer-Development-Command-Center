import { describe, expect, it } from "vitest";
import { projectInput } from "@/features/projects/schemas";
import { clientInput } from "@/features/clients/schemas";
import { inviteInput } from "@/features/users/schemas";

const base = { name: "Storefront", status: "ACTIVE" as const };

describe("projectInput", () => {
  it("turns empty optional fields into null", () => {
    const parsed = projectInput.parse({ ...base, description: "", repoUrl: "", dueDate: "", clientId: "" });
    expect(parsed).toMatchObject({
      description: null,
      repoUrl: null,
      dueDate: null,
      clientId: null,
      technologies: [],
    });
  });

  it("requires a name", () => {
    expect(projectInput.safeParse({ ...base, name: "  " }).success).toBe(false);
  });

  it("rejects URLs without a protocol", () => {
    const result = projectInput.safeParse({ ...base, repoUrl: "github.com/acme/repo" });
    expect(result.success).toBe(false);
  });

  it("rejects a due date before the start date", () => {
    const result = projectInput.safeParse({ ...base, startDate: "2026-05-10", dueDate: "2026-05-01" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["dueDate"]);
  });

  it("de-duplicates technologies", () => {
    const parsed = projectInput.parse({ ...base, technologies: ["Next.js", "Next.js", "Prisma"] });
    expect(parsed.technologies).toEqual(["Next.js", "Prisma"]);
  });
});

describe("clientInput", () => {
  it("normalises email and validates it", () => {
    expect(clientInput.parse({ name: "Acme", email: "Sara@Acme.TEST" }).email).toBe("sara@acme.test");
    expect(clientInput.safeParse({ name: "Acme", email: "nope" }).success).toBe(false);
  });
});

describe("inviteInput", () => {
  it("lowercases email and only accepts known roles", () => {
    expect(inviteInput.parse({ email: " Dev@Team.io ", role: "LEAD" }).email).toBe("dev@team.io");
    expect(inviteInput.safeParse({ email: "dev@team.io", role: "OWNER" }).success).toBe(false);
  });
});
