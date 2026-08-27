# Optimizer specification

For each accelerated obligation d and month m, `x[d,m]` is the non-negative integer count of atomic units U allocated in that month.

## Hard constraints
- encoded totals are conserved;
- regular A allocations are integer multiples of U;
- fixed obligations stay on native schedule;
- no payment occurs before native start;
- accelerated obligations have no gaps from start through completion;
- all obligations clear by zero day;
- irregular B atoms and one-offs follow configured front-load policy.

## Lexicographic objective
1. Minimize maximum monthly requirement.
2. With the best peak fixed, improve leveling.
3. With prior values fixed, maximize front-loading weighted toward earlier months.
4. With prior values fixed, minimize the final-month requirement.

Production uses OR-Tools CP-SAT. A deterministic greedy fallback preserves hard financial invariants for development environments without OR-Tools but does not claim global optimality.
