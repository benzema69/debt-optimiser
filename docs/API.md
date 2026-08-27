# API surface

- `GET /health`: runtime health probe.
- `GET /v1/seed`: canonical seed codes and checksum MT.
- `POST /v1/parse`: parse/validate one DSL code.
- `POST /v1/validate`: validate a batch and detect duplicate IDs.
- `POST /v1/optimize`: return solver identity, allocations and metrics.
- `POST /v1/simulate`: compare before/after plans with a candidate code without mutating source data.
