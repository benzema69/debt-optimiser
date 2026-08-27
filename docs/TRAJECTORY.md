# Daily generation trajectory

The optimizer solves monthly allocation. The trajectory layer deterministically expands each solved month into a daily operating target without changing the optimizer's financial allocation.

For month `m`:

`daily_target[m] = optimized_month_total[m] / calendar_days[m]`

The cumulative target is the running sum across the complete optimization window.

For the canonical seed plan solved by CP-SAT:

| Month | Optimized total | Days | Daily target |
|---|---:|---:|---:|
| Sep 2026 | CHF 2,951 | 30 | CHF 98.37 |
| Oct 2026 | CHF 2,921 | 31 | CHF 94.23 |
| Nov 2026 | CHF 2,921 | 30 | CHF 97.37 |
| Dec 2026 | CHF 2,921 | 31 | CHF 94.23 |
| Jan 2027 | CHF 2,921 | 31 | CHF 94.23 |

Global total is CHF 14,635 over 153 calendar days, a global average of CHF 95.65/day.

The daily trajectory is an operating target, not a new payment schedule. Exact creditor due-day constraints can be added later as first-class DSL/domain constraints without changing the source-code/optimizer/output separation.
