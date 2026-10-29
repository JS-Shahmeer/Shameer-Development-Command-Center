import { describe, expect, it } from "vitest";
import { draftSchema, findCycle, toDraft, type ClaudeBreakdown } from "@/features/ai/schemas";

const task = (over: Partial<ClaudeBreakdown["tasks"][number]> = {}) => ({
  ref: "T1",
  title: "Build login",
  description: "Email and password form.",
  priority: "HIGH" as const,
  estimateHours: 3,
  acceptanceCriteria: ["Form validates email"],
  dependsOn: [],
  ...over,
});

describe("toDraft", () => {
  it("maps Claude output to included, unassigned draft rows", () => {
    const draft = toDraft({ summary: " Login ", openQuestions: ["SSO?", " "], tasks: [task()] });
    expect(draft.summary).toBe("Login");
    expect(draft.openQuestions).toEqual(["SSO?"]);
    expect(draft.items[0]).toMatchObject({ ref: "T1", include: true, assigneeId: null, estimateHours: 3 });
  });

  it("renames duplicate refs and drops dangling or self dependencies", () => {
    const draft = toDraft({
      summary: "",
      openQuestions: [],
      tasks: [task(), task({ ref: "T1", dependsOn: ["T1", "T9"] }), task({ ref: "T3", dependsOn: ["T1"] })],
    });
    expect(draft.items.map((i) => i.ref)).toEqual(["T1", "T2", "T3"]);
    expect(draft.items[1]!.dependsOn).toEqual(["T1"]);
    expect(draft.items[2]!.dependsOn).toEqual(["T1"]);
  });

  it("rounds estimates to the quarter hour and clamps negatives", () => {
    const draft = toDraft({
      summary: "",
      openQuestions: [],
      tasks: [task({ estimateHours: 2.37 }), task({ ref: "T2", estimateHours: -4 })],
    });
    expect(draft.items.map((i) => i.estimateHours)).toEqual([2.25, 0]);
  });

  it("produces a draft that passes its own schema", () => {
    const draft = toDraft({ summary: "x", openQuestions: [], tasks: [task(), task({ ref: "T2" })] });
    expect(draftSchema.safeParse(draft).success).toBe(true);
  });
});

describe("findCycle", () => {
  it("returns null for a DAG", () => {
    expect(
      findCycle([
        { ref: "A", dependsOn: [] },
        { ref: "B", dependsOn: ["A"] },
        { ref: "C", dependsOn: ["A", "B"] },
      ]),
    ).toBeNull();
  });

  it("finds a loop", () => {
    const cycle = findCycle([
      { ref: "A", dependsOn: ["C"] },
      { ref: "B", dependsOn: ["A"] },
      { ref: "C", dependsOn: ["B"] },
    ]);
    expect(cycle).not.toBeNull();
    expect(cycle![0]).toBe(cycle![cycle!.length - 1]);
  });

  it("ignores refs that aren't in the list", () => {
    expect(findCycle([{ ref: "A", dependsOn: ["Z"] }])).toBeNull();
  });
});

describe("draftSchema", () => {
  it("rejects duplicate refs", () => {
    const item = { ref: "T1", title: "x" };
    expect(draftSchema.safeParse({ items: [item, item] }).success).toBe(false);
  });

  it("requires a title", () => {
    expect(draftSchema.safeParse({ items: [{ ref: "T1", title: "  " }] }).success).toBe(false);
  });
});
