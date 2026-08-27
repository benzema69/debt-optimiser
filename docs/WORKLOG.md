# Engineering worklog

This file is the chronological build journal for Debt Optimiser. It is intentionally kept in-repository so architecture decisions and implementation status remain recoverable.

## 2026-08-28, Phase 0, project initialization
- Initialized `benzema69/debt-optimiser`.
- Confirmed target: a reusable discrete cash-flow optimizer, not a one-off debt spreadsheet.
- Locked the source-of-truth concept: immutable composite obligation codes feed a parser, validator, optimizer, ledger and UI.
- Locked seed scenario: CHF 14,635 total, 2026-09-01 through 2027-01-31, zero remaining liability from 2027-02-01.
- Added documentation-first workflow under `docs/`.

## 2026-08-28, Phase 1, DSL and domain model
- Added explicit `U` token for atomic unit size.
- Added `ACC` and `FIX` scheduling policies.
- Defined A blocks as regular unit-compatible pools and B blocks as explicit irregular atoms.
- Defined compact `MYYMYY` period parsing.
- Added hard validation: unique IDs, counts, checksums, positive values, policy, dates and A/U divisibility.

## 2026-08-28, Phase 2, optimizer
- Designed CP-SAT integer model.
- Added no-gap semantics for accelerated obligations.
- Added fixed schedule handling.
- Added September front-loading for irregular B atoms and one-offs when eligible.
- Added non-increasing monthly load constraint by default: Sep >= Oct >= Nov >= Dec >= Jan.
- Added lexicographic optimization and a deterministic development fallback with whole-unit repair.

## 2026-08-28, Phase 3, API and tests
- Added FastAPI endpoints for health, seed, parse, validate, optimize and simulate.
- Added parser/validation/optimizer invariant tests.
- Added CHF 14,635 checksum test.
- Added dynamic C14 integration test proving a new valid code can be parsed and reoptimized without schema/formula changes.
- Caught and corrected an invalid compact period in the sandbox example during test expansion.
- Local verification after correction: **12 tests passing**.
- Local fallback seed profile after whole-unit repair: Sep 3003, Oct 2946, Nov 2928, Dec 2879, Jan 2879. This is a valid descending integer-unit plan, not a claim of CP-SAT global optimum.

## 2026-08-28, Phase 4, web cockpit
- Added Next.js dashboard shell, engine status, KPI cards, monthly matrix, load profile, code DB and sandbox.
- Added local Actuals/event preview.
- Ran TypeScript transpilation syntax checks over application source files in the development environment.

## 2026-08-28, Phase 5, persistence/deployment scaffolding
- Added PostgreSQL/Supabase schema, Docker scaffolding, environment template and CI.
- Base Supabase migration enables RLS and deliberately provides no permissive data policies.

## 2026-08-28, Phase 6, Git workflow
- Development isolated on `feat/core-engine-v1`.
- Opened PR #1 into `main` with architecture and invariant summary.
- PR #1 was merged into `main`.

## 2026-08-28, Phase 7, hosted database hardening
- Created Supabase project `debt-optimiser` in `eu-central-2` under the approved organization.
- Applied the base schema migration.
- Added and applied authenticated ownership migration: `user_id` is required, references `auth.users`, and all four public tables have RLS ownership policies.
- Added `updated_at` trigger for obligations.
- Ran Supabase security advisor after migration: **zero security lints**.
- Added covering indexes for foreign-key joins used by ledger and allocation persistence.
- Generated and integrated Supabase-compatible TypeScript database types.

## 2026-08-28, Phase 8, authenticated cockpit persistence
- Added browser Supabase client with publishable-key support.
- Added email/password authentication UI.
- Added private-workspace bootstrap flow: anonymous users see the canonical local seed; authenticated accounts load their own obligation rows; an empty account can explicitly persist the canonical seed.
- Added typed persistence helpers for obligations and ledger events.
- Sandbox-applied codes persist automatically after parser validation when authenticated.
- Removing a code deactivates its persisted obligation rather than destroying audit history.
- Upgraded Actuals from local preview to an authenticated generation/payment ledger with dated `INCOME`, `PAYMENT`, `ADJUSTMENT`, and `REVERSAL` events.
- Added cloud/local mode indicators and responsive cockpit styles.
- CI caught an initial Supabase generic typing error in the web build; database types were replaced with Supabase-compatible generated structure before continuing.

## Remaining production work
- wait for green CI on the authenticated persistence build;
- deploy an API runtime containing OR-Tools CP-SAT;
- deploy the Next.js frontend and set API/Supabase environment variables;
- verify Supabase Auth redirect/site configuration against the deployed frontend;
- run end-to-end smoke tests for sign-in, seed persistence, add/remove code, optimizer, sandbox and ledger events;
- move the GitHub repository to private before treating the hosted instance as the canonical location for personal financial source data.
