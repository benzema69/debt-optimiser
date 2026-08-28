# Production deployment runbook

The repository is a monorepo with two deployable Vercel projects backed by one Supabase project.

## 1. Hosted database

Supabase project:

- project: `debt-optimiser`
- region: `eu-central-2`
- project ref: `snxssmpfblahqujisicl`
- public API URL: `https://snxssmpfblahqujisicl.supabase.co`

Applied migrations:

1. `0001_init.sql`
2. `0002_auth_rls.sql`
3. `0003_indexes.sql`

All four public tables have RLS enabled and four ownership policies each. The security advisor is clean. The hosted tables intentionally remain empty until an authenticated user explicitly persists the canonical source codes.

## 2. Vercel API project

Import the GitHub repository `benzema69/debt-optimiser` as a Vercel project with:

- project name: `debt-optimiser-api`
- Root Directory: `apps/api`
- Framework Preset: FastAPI / Other if FastAPI is not auto-selected
- Python runtime: 3.12+

The project contains:

- `pyproject.toml` with `[tool.vercel] entrypoint = "app.main:app"`
- `vercel.json` with a 60-second maximum duration for `app/main.py`
- `requirements.txt` containing OR-Tools CP-SAT

Environment variables:

```text
CORS_ORIGINS=https://<WEB_PROJECT_DOMAIN>
```

No Supabase service-role secret is required by the current API because persistence is performed by the authenticated browser client under RLS. Do not add a service-role key unless the server architecture changes.

After deployment verify:

```text
GET https://<API_DOMAIN>/health
```

Expected JSON contains `ok: true` and API version `1.1.0`.

Then call `/v1/optimize` using the canonical seed and verify `solver` is `cp-sat`, not the development fallback.

## 3. Vercel web project

Import the same repository as a second Vercel project with:

- project name: `debt-optimiser`
- Root Directory: `apps/web`
- Framework Preset: Next.js

Environment variables:

```text
NEXT_PUBLIC_API_BASE_URL=https://<API_DOMAIN>
NEXT_PUBLIC_SUPABASE_URL=https://snxssmpfblahqujisicl.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<Supabase publishable key>
```

The publishable browser key is expected client-side. Authorization is enforced by database RLS. Never expose a Supabase service-role key through `NEXT_PUBLIC_*`.

## 4. Supabase Auth URLs

After the web production domain exists, set that domain as the Supabase Auth Site URL and add the production/preview redirect URLs that are actually required. Do not use wildcard redirects broader than necessary for a personal financial application.

## 5. CORS finalization

Once the web domain is known, update the API project's `CORS_ORIGINS` to the exact production origin. Add explicit preview origins only when needed. The API currently enables credentials, so broad `*` origins must not be used.

## 6. Production smoke test

Run in order:

1. `/health` returns healthy API version.
2. Anonymous web session loads the canonical local demo and writes nothing to Supabase.
3. Create/sign into an account.
4. Persist canonical database, then reload and confirm the 13 source codes return from Supabase.
5. Confirm source checksum is CHF 14,635.
6. Confirm optimization is valid, all regular allocations are integer U multiples and February liability is CHF 0.
7. Sandbox a valid C14 and confirm before/after impact without mutation.
8. Apply C14, reload, confirm persistence, then remove/deactivate it.
9. Add a PAYMENT event tied to an obligation and confirm `/v1/reoptimize` creates a reduced integer-valid plan.
10. Try a deliberately non-representable ACC payment and confirm the system rejects it rather than rounding.
11. Add a valid FIX prefix payment and confirm its next native month advances.
12. Persist an optimization snapshot and confirm a run plus allocations exist only for the signed-in user.
13. Sign out and confirm hosted rows are not readable anonymously.

## 7. Repository privacy

Before the hosted system becomes the canonical location for real personal financial state, change the GitHub repository from public to private. The application itself is protected by Supabase Auth/RLS, but the repository currently contains canonical example/entity codes and should not be treated as a private vault while public.

## 8. Local development

API:

```bash
cd apps/api
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Web:

```bash
cd apps/web
npm install
npm run dev
```

Web local environment:

```text
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
NEXT_PUBLIC_SUPABASE_URL=https://snxssmpfblahqujisicl.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable key>
```

API local environment:

```text
CORS_ORIGINS=http://localhost:3000
```
