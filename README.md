# Developer Command Center

An internal workspace for running client projects: projects, clients, links, team members, notes and recent activity in one place, with invite-only sign-in and role-based access enforced on the server.

Built with Next.js (App Router), TypeScript, Tailwind CSS, PostgreSQL, Prisma and Auth.js.

## Status

This is **Phase 1** of the plan in the [architecture doc](https://claude.ai/artifact/WzSWtrPTU4bsyaSSnNm1Ne).

| Phase | Scope | State |
| --- | --- | --- |
| 1. Foundation | GitHub sign-in with invites, roles, clients, projects, members, notes, dashboard basics, seed, CI | Done |
| 2. Core work | Tasks (priorities, dependencies, acceptance criteria), team profiles and workloads, full dashboard | Next |
| 3. Insight and AI | Global search, daily and weekly reports, AI task breakdown with human approval | Later |

## Roles

Permissions live in [`src/lib/permissions.ts`](src/lib/permissions.ts) and every service calls them, so hiding a button is never the only guard.

| Action | Admin | Project lead | Developer |
| --- | --- | --- | --- |
| Invite users, change roles, deactivate | Yes | No | No |
| Create projects, manage clients | Yes | Yes | No |
| Edit, archive, manage members | Any project | Projects they lead | No |
| View projects and notes | All | Projects they lead or belong to | Projects they belong to |
| Write notes | Any | Their projects | Their projects (edit own only) |
| Delete clients | Yes | No | No |

## Local setup

Requirements: Node 20+, pnpm 10 (`corepack enable`), and Docker (or any Postgres 16).

```bash
pnpm install
cp .env.example .env          # then set AUTH_SECRET: openssl rand -base64 32
docker compose up -d          # Postgres on localhost:5432
pnpm db:migrate               # apply migrations
pnpm db:seed                  # sample users, clients, projects, notes
pnpm dev                      # http://localhost:3000
```

With `AUTH_DEV_LOGIN="true"` the sign-in page shows a **development-only** picker to sign in as any seeded user (admin, leads, developers) without GitHub. It only works under `next dev`; production builds ignore it.

To test real GitHub sign-in locally, create a GitHub OAuth app with callback `http://localhost:3000/api/auth/callback/github`, set `AUTH_GITHUB_ID` and `AUTH_GITHUB_SECRET`, and set `ADMIN_EMAIL` to your GitHub email.

## Scripts

| Command | What it does |
| --- | --- |
| `pnpm dev` | Start the dev server |
| `pnpm build` | Generate the Prisma client and build |
| `pnpm lint` / `pnpm typecheck` | ESLint and TypeScript checks |
| `pnpm test` | Unit tests (permissions, validation) |
| `pnpm test:integration` | Service tests against a real database. **Wipes the database in `DATABASE_URL`**, so point it at a throwaway one |
| `pnpm db:migrate` | Create or apply migrations in development |
| `pnpm db:deploy` | Apply migrations without prompting (CI and production) |
| `pnpm db:seed` | Reset and load sample data (refuses to run in production) |
| `pnpm db:studio` | Browse the database |

Example integration run against a separate database:

```bash
createdb dcc_test   # or via docker exec
DATABASE_URL=postgresql://dcc:dcc@localhost:5432/dcc_test DIRECT_URL=$DATABASE_URL pnpm db:deploy
DATABASE_URL=postgresql://dcc:dcc@localhost:5432/dcc_test pnpm test:integration
```

## Deploying to Vercel

1. Import the repository in Vercel.
2. Add **Neon** from the Vercel Marketplace (Storage tab). It sets `DATABASE_URL` (pooled). Add `DIRECT_URL` with the unpooled connection string from Neon.
3. Create a GitHub OAuth app for production with callback `https://<your-domain>/api/auth/callback/github`.
4. In Project Settings, Environment Variables, add `AUTH_SECRET`, `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET` and `ADMIN_EMAIL`. Do **not** set `AUTH_DEV_LOGIN`.
5. Deploy. The `vercel-build` script runs `prisma migrate deploy` before `next build`, so migrations apply on every deploy. Don't run `pnpm db:seed` against production.
6. Sign in with the `ADMIN_EMAIL` GitHub account, then invite your team from **Users**. Invitees sign in at `/sign-in` with the GitHub account that uses the invited email.

Preview deployments run migrations too, so give the Preview environment its own database (Neon's Vercel integration can create a branch per preview).

## Project structure

```
src/
  app/                  routes: (auth)/sign-in, (app)/dashboard, projects, clients, settings/users
  features/<feature>/   schemas.ts (Zod), service.ts (data + permission checks),
                        actions.ts (Server Actions), components/
  components/ui         buttons, inputs, dialogs, menus
  components/shared     page header, empty and error states, form field, confirm dialog
  lib/                  auth, db, env checks, permissions, action wrapper, activity log
prisma/                 schema, migrations, seed
tests/unit              permission and validation tests
tests/integration       service tests against Postgres
```

Writes go through `createAction` in `src/lib/action.ts`, which requires an active user, validates input with Zod and turns errors into toasts. Each service checks permissions and records an `ActivityLog` entry. The current user is reloaded from the database on every request, so role changes and deactivation apply immediately.

## Security notes

- Secrets only come from environment variables, checked at startup in `src/lib/env.ts`. `.env` is git-ignored.
- Sign-in is invite-only: the bootstrap `ADMIN_EMAIL`, existing active users, or an unexpired invite.
- Projects a user can't access return 404 rather than revealing they exist.
- Standard security headers are set in `next.config.ts`.
