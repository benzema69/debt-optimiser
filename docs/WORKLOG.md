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
- Added lexicographic optimization and a deterministic development fallback.

## 2026-08-28, Phase 3, API and tests
- Added FastAPI endpoints for health, seed, parse, validate, optimize and simulate.
- Added parser/validation/optimizer invariant tests.
- Added CHF 14,635 checksum test.

## 2026-08-28, Phase 4, web cockpit
- Added Next.js dashboard shell, engine status, KPI cards, monthly matrix, load profile, code DB and sandbox.

## 2026-08-28, Phase 5, persistence/deployment scaffolding
- Added PostgreSQL/Supabase schema, Docker scaffolding, environment template and CI.

## Provider-side follow-up
- create/link Supabase project and apply migrations;
- deploy an API runtime with OR-Tools;
- deploy Next.js frontend and set API URL;
- configure authentication/RLS before hosted personal financial data.
