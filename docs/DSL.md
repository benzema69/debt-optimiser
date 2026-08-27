# Composite obligation DSL v2

## Canonical form
`C#-ENTITY-U###-POLICY-N-[PAYMENT BLOCKS]-PERIOD-MT####`

Example:
`C1-BCV-U300-ACC-11-10N300A-1N160B-926727-MT3160`

## Tokens
- `C#`: immutable object identifier.
- `ENTITY`: uppercase short code.
- `U###`: atomic regular unit.
- `ACC`: regular unit pool may be accelerated earlier, subject to constraints.
- `FIX`: native monthly schedule is fixed.
- `N`: total encoded payment count.
- `xNyA`: x payments of amount y in regular block A. A amounts must be integer multiples of U.
- `xNyB`: explicit irregular block B. B does not have to be divisible by U.
- `PERIOD`: start/end month token, each side MYY or MMYY. `926727` means Sep 2026 through Jul 2027. `9261126` means Sep 2026 through Nov 2026.
- `MT####`: total encoded amount.

## Validation invariants
1. ID unique in a batch.
2. Unit and total positive.
3. Policy is ACC or FIX.
4. Block counts sum to N.
5. Block values sum to MT.
6. Every A amount is divisible by U.
7. Start is not after native end.
8. Invalid codes are excluded from optimization.

## ACC semantics
The optimizer expands A into atomic units. `U130 + 3N390A` becomes 9 atomic units of CHF 130. It may pay several units in one month but never a fractional unit. There are no skipped months while a regular balance remains.

## FIX semantics
The encoded schedule is preserved across the native period. v1 requires a deterministic one-payment-per-native-month mapping.

## B semantics
B is an explicit irregular amount. In the seed cleanup policy, eligible B atoms are front-loaded into September.
