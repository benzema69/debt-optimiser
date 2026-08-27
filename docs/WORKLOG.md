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
- Local fallback verification initially reached 12 passing tests.

## 2026-08-28, Phase 4, web cockpit
- Added Next.js dashboard shell, engine status, KPI cards, monthly matrix, load profile, code DB and sandbox.
- Added local Actuals/event preview.
- Added conditional visual language for valid/error states, ACC/FIX policies, monthly load intensity and zero-liability state.

## 2026-08-28, Phase 5, persistence/deployment scaffolding
- Added PostgreSQL/Supabase schema, Docker scaffolding, environment template and CI.
- Base Supabase migration enables RLS and deliberately provides no permissive data policies.

## 2026-08-28, Phase 6, Git workflow and CI
- Built v1 on `feat/core-engine-v1`, opened PR #1 and merged it into `main`.
- First post-merge CI exposed a Python import-path configuration error before tests could execute.
- Fixed CI on PR #2 by setting `PYTHONPATH=.` for the API job.
- Verified both API and Next.js jobs pass on GitHub Actions.

## 2026-08-28, Phase 7, optimizer hardening
- Added safe Pydantic default factories.
- Added explicit one-off semantics to the domain model.
- Enforced full first-eligible-month allocation for ACC one-offs when `frontload_one_off=true`.
- Made fallback behavior respect `frontload_b=false` rather than silently overriding configuration.
- Added post-solve descending-load and no-gap integrity checks.
- Locked the production OR-Tools seed optimum in regression tests.
- Production CP-SAT optimum for the seed scenario is: **Sep CHF 2,951; Oct CHF 2,921; Nov CHF 2,921; Dec CHF 2,921; Jan CHF 2,921**.
- Peak monthly generation requirement is therefore **CHF 2,951** under the current hard constraints and lexicographic objective.
- PR #3 CI executed with OR-Tools 9.15 and **14 tests passed**. Next.js production build also passed.
- Merged PR #3 into `main`.

## 2026-08-28, Phase 8, daily trajectory cockpit
- Added deterministic expansion of optimized monthly totals into a 153-day generation trajectory.
- Added per-month CHF/day, CHF/week and cumulative-end targets.
- Added cumulative SVG trajectory visualization and time-phase state (pre-window, active, post-window).
- Wired the trajectory panel directly to optimizer metrics, with no duplicated financial constants.

## Provider-side follow-up
- create/link a dedicated Supabase project and apply migrations;
- add authentication and user-scoped RLS policies before hosted personal financial data;
- deploy the Python OR-Tools API;
- deploy the Next.js frontend and set its API URL;
- replace the local Actuals preview with the persistent event ledger.
