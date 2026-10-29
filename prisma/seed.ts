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

const users: { email: string; name: string; role: Role; title: string }[] = [
  { email: "admin@example.dev", name: "Ayesha Admin", role: "ADMIN", title: "Engineering manager" },
  { email: "lead@example.dev", name: "Leo Lead", role: "LEAD", title: "Tech lead, web" },
  { email: "mobile.lead@example.dev", name: "Maya Mobile", role: "LEAD", title: "Tech lead, mobile" },
  { email: "dev1@example.dev", name: "Dan Developer", role: "DEVELOPER", title: "Full-stack developer" },
  { email: "dev2@example.dev", name: "Priya Patel", role: "DEVELOPER", title: "React Native developer" },
];

async function main() {
  // Start clean so the seed can be re-run safely.
  await db.$transaction([
    db.activityLog.deleteMany(),
    db.note.deleteMany(),
    db.projectMember.deleteMany(),
    db.project.deleteMany(),
    db.client.deleteMany(),
    db.invite.deleteMany(),
  ]);

  const byEmail: Record<string, string> = {};
  for (const u of users) {
    const user = await db.user.upsert({
      where: { email: u.email },
      update: { name: u.name, role: u.role, title: u.title, isActive: true },
      create: u,
    });
    byEmail[u.email] = user.id;
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

  await db.invite.create({
    data: {
      email: "new.hire@example.dev",
      role: "DEVELOPER",
      expiresAt: days(14),
      invitedById: id("admin@example.dev"),
    },
  });

  console.log(`Seeded ${users.length} users, 2 clients, ${projects.length} projects.`);
  console.log("Sign in locally with AUTH_DEV_LOGIN=true and pick any seeded user.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
