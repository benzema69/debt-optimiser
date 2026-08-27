# Debt Optimiser

A discrete cash-flow optimisation engine driven by a compact financial obligation DSL.

The seed scenario models **CHF 14,635** of obligations over **153 calendar days**, from 1 Sep 2026 through 31 Jan 2027, with the hard requirement that planned liability is **CHF 0 from 1 Feb 2027**.

## Stack
- Next.js + TypeScript cockpit
- FastAPI + Python domain/API layer
- Google OR-Tools CP-SAT integer optimizer
- PostgreSQL / Supabase persistence schema
- GitHub Actions CI

## DSL
`C1-BCV-U300-ACC-11-10N300A-1N160B-926727-MT3160`

`U` is the atomic regular unit. Every optimizer-created regular payment is `k × U` where `k` is a non-negative integer. `B` blocks are explicit irregular atoms, not fractional units synthesized by the optimizer.

See `docs/DSL.md`, `docs/OPTIMIZER.md` and `docs/WORKLOG.md`.
