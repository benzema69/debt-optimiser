# Architecture

Debt Optimiser is a declarative discrete cash-flow planning engine.

```text
Composite codes -> Parser -> Validator -> Domain model -> Optimizer -> Plan
                                               |             |
                                               v             v
                                            Ledger       Dashboard
                                               |
                                               v
                                            Actuals
```

## Components
- **Web, Next.js + TypeScript:** source code entry, KPIs, monthly allocation matrix, sandbox, actuals UI.
- **API, FastAPI + Python:** canonical parsing, hard validation, seed dataset, optimization and simulation.
- **Optimizer, OR-Tools CP-SAT:** all regular allocations are integer multiples of each obligation's atomic unit.
- **Data, PostgreSQL/Supabase:** raw code is source truth; ledger events are append-oriented; optimization runs are versioned snapshots.

## Seed scenario
- Start: 2026-09-01
- Zero day: 2027-01-31
- Remaining balance on 2027-02-01: CHF 0
- Seed MT checksum: CHF 14,635

## Core invariant
`payment = k * U`, where `k` is a non-negative integer. B atoms are explicit source exceptions and are never synthesized by the optimizer.
