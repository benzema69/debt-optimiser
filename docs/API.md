# API surface

- `GET /health`: runtime health probe.
- `GET /v1/seed`: canonical seed codes and checksum MT.
- `POST /v1/parse`: parse/validate one DSL code.
- `POST /v1/validate`: validate a batch and detect duplicate IDs.
- `POST /v1/optimize`: return solver identity, integer allocations and metrics.
- `POST /v1/reoptimize`: reconcile cumulative real payments against A/B/FIX semantics, construct remaining obligations, then optimize the remaining path to zero.
- `POST /v1/simulate`: compare before/after plans with a candidate code without mutating source data.

## Reoptimization contract

Request example:

```json
{
  "codes": ["C1-BCV-U300-ACC-11-10N300A-1N160B-926727-MT3160"],
  "paid_by_id": {"C1": 460},
  "config": {
    "optimization_start": "2026-10-01",
    "zero_day": "2027-01-31",
    "frontload_b": true,
    "frontload_one_off": true,
    "descending_load": true
  }
}
```

For `ACC`, a payment is accepted only when it can be represented as a valid combination of declared irregular B atoms plus an integer number of U units. The reconciler consumes the maximum compatible B amount first, matching the B-frontload policy. For `FIX`, paid-to-date must equal an exact prefix sum of the native fixed schedule. Overpayments, unknown IDs and non-representable payments are hard errors rather than silent approximations.

A successful response includes `paid_to_date`, `original_mt`, `remaining_mt`, a per-object reconciliation summary, and the optimized remaining result. If every object is fully paid, `remaining_mt` is zero and `result` is `null` because no future allocation remains.
