# Campus Placement & Internship Portal

A three-tier, multi-page campus recruitment application with separate Student, Company Recruiter, and Placement Cell Admin workflows. Records persist in SQLite (Cloudflare D1). The server enforces eligibility, roles, recruiter ownership, approvals, and pipeline transitions.

## Local setup

Requirements: Node.js **22.13+**, pnpm **11.25.0** (or `npx pnpm@11.25.0`), and Git. Python 3 is needed only for integration tests. No Cloudflare account or API key is required for local development.

```bash
# After cloning or extracting the source package:
cd campus-placement
pnpm install --frozen-lockfile
pnpm build
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Open **http://localhost:5173**. To preview the compiled Worker instead, run `pnpm start` and use the address printed by Wrangler.

`pnpm db:migrate` applies committed Drizzle migrations to local D1 and records applied files. `pnpm db:seed` is idempotent and populates mock accounts, companies, openings, applications, timelines, and audit logs. An empty, migrated database is also populated on its first API request. Runtime initialization never creates or alters tables.

To reset a **disposable local demo**, stop the server, delete `.wrangler/state` and `.wrangler/applied-migrations.json`, then rerun `pnpm db:migrate` and `pnpm db:seed`. This removes the local demo data.

## Mock login credentials

Every mock account uses **`Campus@123`**.

| Role / purpose | Email | Demo profile |
| --- | --- | --- |
| Student | `student@campus.test` | CSE, CGPA 8.6, graduating 2027 |
| Company recruiter | `recruiter@campus.test` | Linear Labs |
| Placement Cell Admin | `admin@campus.test` | Company/job reviews and action log |
| Ineligible student | `ineligible@campus.test` | MECH, CGPA 6.2; eligibility rejection demonstration |
| Another recruiter | `recruiter2@campus.test` | Orbit Systems; ownership isolation demonstration |
| Another student | `ananya@campus.test` | CSE, CGPA 9.1 |
| Pending recruiter | `pending@campus.test` | Nova Analytics; company awaiting review |

The login role selector pre-fills primary demo credentials. It does not determine authorization; the server reads the role from the authenticated account. New recruiter registration is supported, but users cannot register as administrators. Newly registered recruiters submit a company profile for approval.

Companies, salaries, and resume links are fictional sample data. Replace the sample resume links with accessible documents to review actual resumes. This is an academic demo with intentionally shared mock accounts.

## Workflows

**Student:** Overview → Explore openings → Opening details → Apply → My applications → Application activity. Manage name, department, CGPA, graduation year, resume link, and skills on the profile page.

**Recruiter:** Register/sign in → Create company profile → Submit for approval → Create job opening → Opening review → Review candidates and resumes → Update individual or multiple applications.

**Admin:** Review company → Approve/reject with a required reason → Review openings → Approve/reject → Inspect administrative action log with timestamp, reviewer ID, and reason.

A company **and** its opening must both be approved before students can see or apply to the opening. Editing a company sends it back for approval and hides its openings until approved again. Rejected companies can correct and resubmit their profile. A revised opening can be submitted as a new posting.

Submission checks the stored student's CGPA, department, graduation cohort, resume presence, posting deadline, and approval state. Forged client eligibility values cannot override the database profile. A unique database index prevents duplicate applications. An application saves a profile/resume snapshot.

Pipeline: **Applied → Shortlisted → Interview → Offered**. Recruiters may reject from any active stage. Offers and rejections are final. Batch requests accept up to 40 candidates and validate every selected application and its owner before changing anything. Status changes and history records use transactional D1 batches.

Student dashboards and application details refresh every **5 seconds** from the shared backend. Tracking uses polling rather than WebSockets.

## Three-tier architecture

| Tier | Technology | Responsibility |
| --- | --- | --- |
| Presentation | React 19, Vinext App Router, Tailwind, Shadcn | Responsive, role-specific multi-page interfaces |
| Application | TypeScript API running on Cloudflare Workers | Authentication, validation, authorization, eligibility, hiring and review workflows |
| Data | SQLite / Cloudflare D1, Drizzle migrations | Persistent relational records, sessions and audit history |

Main files:

- `app/page.tsx`: login and recruiter registration.
- `app/[...path]/page.tsx`: server-authenticated role routes; wrong-role visits redirect to the user's portal.
- `app/portal.tsx`: role-specific dashboards, forms, tables, detail pages, timelines and batch actions.
- `app/api/[...path]/route.ts`: protected server API.
- `lib/rules.ts`: eligibility and permitted status transitions.
- `lib/auth.ts`: password verification, sessions, role checks and cross-origin checks.
- `db/schema.ts` and `drizzle/`: database schema and generated migrations.
- `db/seed.sql` and `lib/seed.ts`: SQL and application demo population.

Passwords use salted PBKDF2-SHA256 hashes (100,000 iterations). Random session tokens are stored hashed, expire after 24 hours, and use HttpOnly/SameSite cookies (Secure over HTTPS). Logout revokes the server session. Failed logins are rate limited. Queries use prepared statements. No API allows audit entries to be changed or deleted.

## Pages

| Role | Pages |
| --- | --- |
| Student | `/student`, `/student/openings`, `/student/openings/:id`, `/student/applications`, `/student/applications/:id`, `/student/profile` |
| Recruiter | `/recruiter`, `/recruiter/openings`, `/recruiter/openings/:id`, `/recruiter/candidates`, `/recruiter/candidates/:id`, `/recruiter/company` |
| Admin | `/admin`, `/admin/companies`, `/admin/companies/:id`, `/admin/openings`, `/admin/openings/:id`, `/admin/audit` |

## API

| Method | Endpoint | Access |
| --- | --- | --- |
| GET | `/api/auth/me` | Current session or anonymous |
| POST | `/api/auth/login`, `/api/auth/register` | Public; registration restricted to recruiters |
| POST | `/api/auth/logout` | Authenticated |
| GET | `/api/dashboard` | Role-filtered records |
| PATCH | `/api/profile` | Student, own profile |
| POST | `/api/company`, `/api/jobs` | Recruiter, own company |
| POST | `/api/applications` | Student, server eligibility gate |
| PATCH | `/api/applications/status` | Recruiter, owned candidates only |
| POST | `/api/reviews` | Admin, required review reason |

## Verification

```bash
pnpm typecheck
pnpm test
# Full API integration in an isolated, disposable Worker database:
pnpm test:worker
# With pnpm dev running and a fresh local demo database:
pnpm test:integration
# To target another local URL:
TEST_BASE_URL=http://localhost:5173 pnpm test:integration
pnpm build
```

Integration checks cover session/role/ownership boundaries, forged eligibility, pending opening visibility, duplicate submissions, batch atomicity, stage transitions, company re-review, and audit records. The suite creates test companies/jobs and changes seeded application stages; run it against a disposable, freshly seeded local database. Reset before rerunning because final pipeline decisions are immutable.

## Publish the public GitHub repository

The source package is ready to push. Create a public repository in your GitHub account before submission. With GitHub CLI installed and authenticated, run inside the source folder:

```bash
git init
git add .
git commit -m "Build three-tier campus recruitment portal"
gh repo create campus-placement-portal --public --source=. --remote=origin --push
```

Alternatively, create an empty public repository through GitHub, then:

```bash
git init
git add .
git commit -m "Build three-tier campus recruitment portal"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/campus-placement-portal.git
git push -u origin main
```

Submit `https://github.com/YOUR_USERNAME/campus-placement-portal`. No GitHub token, Cloudflare credential, live database, session, or dependency directory is included in the source archive.

## Deployment

Local development uses a local SQLite database through Cloudflare D1. All logins use the application's own email/password sessions. No external identity provider is required.

To deploy this Worker on your own Cloudflare account, install the dependencies and run:

```bash
pnpm exec wrangler login
pnpm exec wrangler d1 create campus-placement
```

Replace the placeholder `database_id` in `wrangler.json` with the returned database ID. Then run:

```bash
pnpm exec wrangler d1 migrations apply DB --remote --config wrangler.json
pnpm exec wrangler d1 execute DB --remote --config wrangler.json --file db/seed.sql
pnpm build
pnpm exec wrangler deploy --config dist/server/wrangler.json
```

These commands create a separate online database. Only seed fictional demo data. The public repository contains source code; running this backend requires Worker hosting and a D1 database. GitHub Pages does not run the backend.

## Demo scope

Students use seeded accounts; recruiter registration is available. Resume fields accept document URLs, with placeholder URLs in the sample data. Tracking polls the server every five seconds. This project is an academic demo, not an institution's production recruitment system.
