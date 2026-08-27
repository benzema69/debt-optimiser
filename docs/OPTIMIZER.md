# Optimizer specification

For each accelerated obligation d and month m, `x[d,m]` is the non-negative integer count of atomic units U allocated in that month.

## Hard constraints
- encoded totals are conserved;
- regular A allocations are integer multiples of U;
- fixed obligations stay on native schedule;
- no payment occurs before native start;
- accelerated obligations have no gaps from start through completion;
- all obligations clear by zero day;
- irregular B atoms and one-offs follow configured front-load policy;
- with `descending_load=true`, monthly totals are constrained to a non-increasing profile: September >= October >= November >= December >= January.

## Lexicographic objective
1. Minimize maximum monthly requirement.
2. With the best peak fixed, maximize the minimum monthly requirement to level the feasible descending profile.
3. With prior values fixed, maximize front-loading weighted toward earlier months.
4. With prior values fixed, minimize the final-month requirement.

The descending profile turns the product requirement "September is heavy, January is the landing month" into an explicit model constraint instead of a visual preference.

Production uses OR-Tools CP-SAT. A deterministic greedy fallback preserves integer-unit, checksum, fixed-schedule and zero-day invariants for development environments without OR-Tools, and includes a whole-unit repair pass for the descending load profile. The fallback does not claim global optimality.
