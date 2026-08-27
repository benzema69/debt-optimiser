# Data model

## obligations
Immutable raw `code` is the source record. Parsed fields are stored for queryability and integrity checks.

## ledger_events
Append-oriented facts such as payments, income, adjustments and reversals. Actual balances are derived from events, not hand-edited aggregate counters.

## optimization_runs
Snapshot of config, input checksum, solver, status and metrics for each run.

## optimization_allocations
Per-run, per-obligation, per-month planned amounts and unit counts.

Source declaration, derived interpretation, optimized plan and actual ledger are separate layers. UI colors are never authoritative financial data.
