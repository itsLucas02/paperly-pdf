# Deployment

Live at **https://paperly-pdf-neon.vercel.app**.

paperly runs on Vercel (Next.js) with an optional Supabase Postgres database and is
maintained by more than one account, so this document records **where things live**
without recording any credentials. Nothing in this file is secret; everything secret
is in Bitwarden.

## Where the secrets are

Credentials are **not in this repository**. They are stored in **Bitwarden Secrets
Manager**, project **`Paperly`**. An onboarding agent should read them from there
rather than asking for them in chat or hunting through shell history.

| Secret name | What it holds |
| --- | --- |
| `PAPERLY__DATABASE_URL` | Postgres connection string used by the app and by migrations |
| `PAPERLY__DB_PASSWORD` | The database password on its own |
| `PAPERLY__SUPABASE_PROJECT_REF` | Which Supabase project the database belongs to |
| `PAPERLY__VERCEL_PROJECT_ID` | Which Vercel project serves the site |
| `PAPERLY__VERCEL_TEAM_ID` | Which Vercel team owns that project |
| `SHARED__VERCEL_SECONDARY_TOKEN` | Vercel API token used to deploy this project |

Retrieve a value with:

```bash
bws secret list                 # find the secret id by key
bws secret get <secret-id>      # print the value
```

The Vercel project already has `DATABASE_URL` set as an encrypted environment
variable for production, preview and development. You normally do **not** need to
read the secret at all — deploying is enough, because Vercel injects it at runtime.

## Deploy

```bash
VERCEL_TOKEN="$SHARED__VERCEL_SECONDARY_TOKEN" vercel deploy --prod --yes
```

Pushing to `main` also triggers a Git-integrated production build, so a merge
deploys itself. Git builds do not run migrations — apply schema changes with
`drizzle-kit push` from a machine that has `DATABASE_URL` (see below).

## Database

The database is **optional**. Without `DATABASE_URL` every PDF tool still works
fully in the browser, and only history, favorites and feedback are disabled
(`/api/workspace` returns 503 and the app falls back to local storage). This means
a deploy can never be broken by a missing database.

Apply schema changes:

```bash
DATABASE_URL="<from Bitwarden>" npx drizzle-kit push
```

Use the **session pooler** connection (port `5432`, `sslmode=require`) for
`DATABASE_URL`. It works for both the app and for migrations, and avoids
transaction-pooling limits on DDL. The transaction pooler (port 6543) is not
suitable for `drizzle-kit push`.

Relevant tables: `paperly_workspaces`, `paperly_jobs`, `paperly_feedback`.

## Verify a deployment

```bash
TEST_URL=https://paperly-pdf-neon.vercel.app node tests/smoke.mjs
TEST_URL=https://paperly-pdf-neon.vercel.app node tests/edge-cases.mjs
```

Both suites drive a real browser. `smoke.mjs` processes one file through all 20
tools and asserts the rendered history list has exactly 20 rows, so it also catches
history-duplication regressions. Run them against production before calling a
deploy good.

## Notes

- The canonical domain is **`paperly-pdf-neon.vercel.app`**. The Vercel project is
  named `paperly-pdf`, but `paperly-pdf.vercel.app` belongs to an unrelated
  third-party app — do not assume it is this project.
- History writes are reconciled by **content** (tool, file name, output size, page
  count) as well as by id. A save can be interrupted by navigation before its
  response lands, which is far more likely on a remote deploy than on localhost;
  without content matching those interrupted saves show up as duplicates.
- Local storage only ever holds the **pending** queue of unsynced jobs. Saved rows
  always come from the database, so clearing local storage cannot lose anything
  that was successfully saved.