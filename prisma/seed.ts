/**
 * Local development seed. Creates sample users, clients, projects and notes so every
 * screen has something to show. Refuses to run against production.
 */
import { PrismaClient, type Role } from "@prisma/client";

const db = new PrismaClient();

if (process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production") {
  throw new Error("Refusing to seed a production database.");
}

const days = (n: number) => new Date(Date.now() + n * 24 * 60 * 60 * 1000);

const users: {
  email: string;
  name: string;
  role: Role;
  title: string;
  capacityHours: number;
  skills: [string, number][];
}[] = [
  {
    email: "admin@example.dev",
    name: "Ayesha Admin",
    role: "ADMIN",
    title: "Engineering manager",
    capacityHours: 10,
    skills: [
      ["Project management", 5],
      ["Node.js", 3],
    ],
  },
  {
    email: "lead@example.dev",
    name: "Leo Lead",
    role: "LEAD",
    title: "Tech lead, web",
    capacityHours: 30,
    skills: [
      ["Next.js", 5],
      ["TypeScript", 5],
      ["PostgreSQL", 4],
    ],
  },
  {
    email: "mobile.lead@example.dev",
    name: "Maya Mobile",
    role: "LEAD",
    title: "Tech lead, mobile",
    capacityHours: 30,
    skills: [
      ["React Native", 5],
      ["Expo", 4],
      ["MongoDB", 3],
    ],
  },
  {
    email: "dev1@example.dev",
    name: "Dan Developer",
    role: "DEVELOPER",
    title: "Full-stack developer",
    capacityHours: 40,
    skills: [
      ["React", 4],
      ["Express", 4],
      ["MongoDB", 4],
      ["Next.js", 3],
    ],
  },
  {
    email: "dev2@example.dev",
    name: "Priya Patel",
    role: "DEVELOPER",
    title: "React Native developer",
    capacityHours: 32,
    skills: [
      ["React Native", 4],
      ["TypeScript", 3],
    ],
  },
];

async function main() {
  // Start clean so the seed can be re-run safely.
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
  ]);

  const byEmail: Record<string, string> = {};
  for (const { skills, ...u } of users) {
    const user = await db.user.upsert({
      where: { email: u.email },
      update: { name: u.name, role: u.role, title: u.title, capacityHours: u.capacityHours, isActive: true },
      create: u,
    });
    byEmail[u.email] = user.id;
    for (const [name, level] of skills) {
      const skill = await db.skill.upsert({ where: { name }, update: {}, create: { name } });
      await db.userSkill.create({ data: { userId: user.id, skillId: skill.id, level } });
    }
  }
  const id = (email: string) => byEmail[email]!;

  const [acme, northwind] = await Promise.all([
    db.client.create({
      data: {
        name: "Acme Retail",
        company: "Acme Retail Ltd",
        contactName: "Sara Khan",
        email: "sara@acme.test",
        phone: "+1 555 0100",
      },
    }),
    db.client.create({
      data: {
        name: "Northwind Health",
        company: "Northwind Health Inc",
        contactName: "Omar Ali",
        email: "omar@northwind.test",
      },
    }),
  ]);

  const projects = [
    {
      name: "Acme storefront rebuild",
      slug: "acme-storefront-rebuild",
      description: "Replace the legacy PHP storefront with a Next.js App Router site and a headless CMS.",
      status: "ACTIVE" as const,
      clientId: acme.id,
      leadId: id("lead@example.dev"),
      startDate: days(-40),
      dueDate: days(12),
      repoUrl: "https://github.com/example/acme-storefront",
      stagingUrl: "https://staging.acme.test",
      productionUrl: "https://acme.test",
      technologies: ["Next.js", "TypeScript", "PostgreSQL", "Prisma"],
      members: [id("dev1@example.dev")],
    },
    {
      name: "Northwind patient app",
      slug: "northwind-patient-app",
      description: "React Native app for appointment booking and lab results.",
      status: "ACTIVE" as const,
      clientId: northwind.id,
      leadId: id("mobile.lead@example.dev"),
      startDate: days(-60),
      dueDate: days(-3),
      repoUrl: "https://github.com/example/northwind-mobile",
      technologies: ["React Native", "Expo", "Node.js", "MongoDB"],
      members: [id("dev2@example.dev"), id("dev1@example.dev")],
    },
    {
      name: "Acme internal analytics",
      slug: "acme-internal-analytics",
      description: "MERN dashboard for store managers. Waiting on data access approval.",
      status: "ON_HOLD" as const,
      clientId: acme.id,
      leadId: id("lead@example.dev"),
      dueDate: days(45),
      technologies: ["MongoDB", "Express", "React", "Node.js"],
      members: [],
    },
    {
      name: "Northwind marketing site",
      slug: "northwind-marketing-site",
      status: "PLANNING" as const,
      clientId: northwind.id,
      leadId: null,
      startDate: days(7),
      dueDate: days(20),
      technologies: ["Next.js", "Tailwind CSS"],
      members: [],
    },
  ];

  for (const { members, ...p } of projects) {
    const project = await db.project.create({
      data: {
        ...p,
        members: {
          create: [
            ...(p.leadId ? [{ userId: p.leadId, role: "LEAD" as const }] : []),
            ...members.map((userId) => ({ userId })),
          ],
        },
      },
    });
    await db.activityLog.create({
      data: {
        actorId: p.leadId ?? id("admin@example.dev"),
        action: "project.created",
        entityType: "Project",
        entityId: project.id,
        projectId: project.id,
        summary: `created project ${project.name}`,
      },
    });
  }

  const storefront = await db.project.findUniqueOrThrow({ where: { slug: "acme-storefront-rebuild" } });
  await db.note.createMany({
    data: [
      {
        projectId: storefront.id,
        authorId: id("lead@example.dev"),
        title: "Deployment checklist",
        body: "1. Merge to main\n2. Vercel builds automatically\n3. Run smoke tests on staging\n4. Promote to production",
        pinned: true,
      },
      {
        projectId: storefront.id,
        authorId: id("dev1@example.dev"),
        title: "Client feedback, sprint 3",
        body: "Sara wants the checkout to support guest users. Logged as a follow-up.",
      },
    ],
  });

  // Tasks for the two active projects.
  const patientApp = await db.project.findUniqueOrThrow({ where: { slug: "northwind-patient-app" } });
  type SeedTask = {
    key: string;
    projectId: string;
    title: string;
    status: "BACKLOG" | "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "BLOCKED" | "DONE";
    priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
    assignee?: string;
    reporter: string;
    due?: number;
    estimate?: number;
    blockedReason?: string;
    criteria?: [string, boolean][];
    dependsOn?: string[];
  };
  const tasks: SeedTask[] = [
    {
      key: "schema",
      projectId: storefront.id,
      title: "Design product catalogue schema",
      status: "DONE",
      priority: "HIGH",
      assignee: "lead@example.dev",
      reporter: "lead@example.dev",
      due: -10,
      estimate: 6,
      criteria: [
        ["Products, variants and categories modelled", true],
        ["Migration reviewed", true],
      ],
    },
    {
      key: "cms",
      projectId: storefront.id,
      title: "Integrate headless CMS for landing pages",
      status: "IN_PROGRESS",
      priority: "MEDIUM",
      assignee: "dev1@example.dev",
      reporter: "lead@example.dev",
      due: 4,
      estimate: 12,
      criteria: [
        ["Editors can publish without a deploy", false],
        ["Preview mode works on staging", false],
      ],
      dependsOn: ["schema"],
    },
    {
      key: "checkout",
      projectId: storefront.id,
      title: "Guest checkout flow",
      status: "TODO",
      priority: "URGENT",
      assignee: "dev1@example.dev",
      reporter: "lead@example.dev",
      due: 8,
      estimate: 16,
      criteria: [
        ["Guest can pay without an account", false],
        ["Order confirmation email sent", false],
        ["Works on mobile Safari", false],
      ],
      dependsOn: ["schema"],
    },
    {
      key: "payments",
      projectId: storefront.id,
      title: "Connect payment provider",
      status: "BLOCKED",
      priority: "HIGH",
      assignee: "lead@example.dev",
      reporter: "lead@example.dev",
      due: -1,
      estimate: 8,
      blockedReason: "Waiting on live API keys from Acme's finance team.",
    },
    {
      key: "seo",
      projectId: storefront.id,
      title: "Set up redirects from old URLs",
      status: "BACKLOG",
      priority: "LOW",
      reporter: "dev1@example.dev",
      estimate: 3,
    },
    {
      key: "auth",
      projectId: patientApp.id,
      title: "Biometric login",
      status: "IN_REVIEW",
      priority: "HIGH",
      assignee: "dev2@example.dev",
      reporter: "mobile.lead@example.dev",
      due: -2,
      estimate: 10,
      criteria: [
        ["Face ID and fingerprint supported", true],
        ["Falls back to PIN", true],
        ["Security review signed off", false],
      ],
    },
    {
      key: "booking",
      projectId: patientApp.id,
      title: "Appointment booking screen",
      status: "IN_PROGRESS",
      priority: "URGENT",
      assignee: "dev2@example.dev",
      reporter: "mobile.lead@example.dev",
      due: 2,
      estimate: 20,
      dependsOn: ["auth"],
    },
    {
      key: "labs",
      projectId: patientApp.id,
      title: "Lab results API endpoint",
      status: "TODO",
      priority: "MEDIUM",
      assignee: "dev1@example.dev",
      reporter: "mobile.lead@example.dev",
      due: 6,
      estimate: 8,
    },
    {
      key: "push",
      projectId: patientApp.id,
      title: "Push notification reminders",
      status: "BACKLOG",
      priority: "MEDIUM",
      reporter: "dev2@example.dev",
      dependsOn: ["booking"],
    },
  ];

  const taskIds: Record<string, string> = {};
  for (const [i, t] of tasks.entries()) {
    const task = await db.task.create({
      data: {
        projectId: t.projectId,
        title: t.title,
        status: t.status,
        priority: t.priority,
        assigneeId: t.assignee ? id(t.assignee) : null,
        reporterId: id(t.reporter),
        dueDate: t.due !== undefined ? days(t.due) : null,
        estimateHours: t.estimate ?? null,
        blockedReason: t.blockedReason ?? null,
        completedAt: t.status === "DONE" ? days(-3) : null,
        position: i,
        criteria: { create: (t.criteria ?? []).map(([text, done], position) => ({ text, done, position })) },
      },
    });
    taskIds[t.key] = task.id;
  }
  for (const t of tasks) {
    for (const dep of t.dependsOn ?? []) {
      await db.taskDependency.create({ data: { taskId: taskIds[t.key]!, dependsOnId: taskIds[dep]! } });
    }
  }
  await db.taskComment.createMany({
    data: [
      {
        taskId: taskIds.payments!,
        authorId: id("lead@example.dev"),
        body: "Chased Sara again today. She expects the keys by Friday.",
      },
      {
        taskId: taskIds.auth!,
        authorId: id("mobile.lead@example.dev"),
        body: "Looks good. Waiting on the security review before we merge.",
      },
    ],
  });
  await db.activityLog.create({
    data: {
      actorId: id("lead@example.dev"),
      action: "task.blocked",
      entityType: "Task",
      entityId: taskIds.payments!,
      projectId: storefront.id,
      summary: `marked "Connect payment provider" blocked: Waiting on live API keys from Acme's finance team.`,
    },
  });

  await db.invite.create({
    data: {
      email: "new.hire@example.dev",
      role: "DEVELOPER",
      expiresAt: days(14),
      invitedById: id("admin@example.dev"),
    },
  });

  console.log(`Seeded ${users.length} users, 2 clients, ${projects.length} projects, ${tasks.length} tasks.`);
  console.log("Sign in locally with AUTH_DEV_LOGIN=true and pick any seeded user.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
