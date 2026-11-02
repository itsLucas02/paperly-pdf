# Deployment

paperly is deployed to the **`dreamin-x`** Vercel team (account `adreamin96-6176`).

| Item | Value |
| --- | --- |
| Production URL | https://paperly-pdf-neon.vercel.app |
| Vercel project | `paperly-pdf` (`prj_suwWKG5sgp32PV99H574SEeHP91I`) |
| Vercel team | `dreamin-x` (`team_HI5laHneEyKGqQiuXf6CaiK5`) |
| Vercel project settings | framework `nextjs`, production branch `main` |
| Database | Supabase Postgres, project `paperly`, region `ap-southeast-1` |
| DB connection | session pooler, port 5432, `sslmode=require` |

Credentials live in **Bitwarden Secrets Manager**, project `Paperly`:

- `PAPERLY__DATABASE_URL`
- `PAPERLY__SUPABASE_PROJECT_REF`
- `PAPERLY__DB_PASSWORD`
- `PAPERLY__VERCEL_PROJECT_ID`
- `PAPERLY__VERCEL_TEAM_ID`

The second Vercel token is `SHARED__VERCEL_SECONDARY_TOKEN` in the same vault.

## First-time setup

```bash
# 1. schema
DATABASE_URL="<session-pooler-url>" npx drizzle-kit push

# 2. environment variable on the Vercel project (all targets)
curl -X POST \
  "https://api.vercel.com/v10/projects/$PAPERLY__VERCEL_PROJECT_ID/env?teamId=$PAPERLY__VERCEL_TEAM_ID&upsert=true" \
  -H "Authorization: Bearer $SHARED__VERCEL_SECONDARY_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"key":"DATABASE_URL","value":"<session-pooler-url>","type":"encrypted","target":["production","preview","development"]}'
```

## Deploy

```bash
VERCEL_TOKEN="$SHARED__VERCEL_SECONDARY_TOKEN" vercel deploy --prod --yes --scope dreamin-x
```

Or push to `main` — the project has GitHub integration, so Vercel builds automatically. GitHub-deployed builds run the migration-free path; apply schema changes with `drizzle-kit push` from a machine that has `DATABASE_URL`.

## Verify a deployment

```bash
TEST_URL=https://paperly-pdf-neon.vercel.app node tests/smoke.mjs
TEST_URL=https://paperly-pdf-neon.vercel.app node tests/edge-cases.mjs
```

The smoke suite asserts that the rendered history list has exactly 20 rows after
20 jobs, so it also catches duplicate-history regressions.

## Notes

- Use the **session pooler (port 5432)** for `DATABASE_URL`. It works for the app
  and for migrations, and avoids transaction-pooling limits on DDL.
- `paperly-pdf.vercel.app` belongs to an unrelated third-party app. The canonical
  domain for this project is `paperly-pdf-neon.vercel.app`.
- The database is optional at runtime: without `DATABASE_URL` every PDF tool still
  works and `/api/workspace` returns 503, falling back to browser local storage.