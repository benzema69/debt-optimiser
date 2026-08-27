from __future__ import annotations

from collections import defaultdict
from datetime import date

from .models import (
    BlockKind, EngineConfig, MonthlyAllocation, Obligation, ObligationPlan,
    OptimizationMetrics, OptimizationResult, Policy, ValidationIssue,
)


def month_key(d: date) -> str:
    return f"{d.year:04d}-{d.month:02d}"


def month_start(d: date) -> date:
    return date(d.year, d.month, 1)


def add_month(d: date, n: int = 1) -> date:
    y = d.year + (d.month - 1 + n) // 12
    m = (d.month - 1 + n) % 12 + 1
    return date(y, m, 1)


def months_between(start: date, end: date) -> list[date]:
    out: list[date] = []
    cur, last = month_start(start), month_start(end)
    while cur <= last:
        out.append(cur)
        cur = add_month(cur)
    return out


def days_inclusive(start: date, end: date) -> int:
    return (end - start).days + 1


def _issue(code: str, error: str, detail: str) -> ValidationIssue:
    return ValidationIssue(code=code, error=error, detail=detail)


def _fixed_schedule(o: Obligation, config: EngineConfig, months: list[date]):
    native = months_between(o.start_month, o.native_end_month)
    payments: list[tuple[int, BlockKind]] = []
    for block in o.blocks:
        payments.extend([(block.amount, block.kind)] * block.count)
    if len(payments) != len(native):
        return {}, {}, {}, [_issue(o.raw_code, "FIX_MAPPING", f"FIX requires one encoded payment per native month; got {len(payments)} payments over {len(native)} months")]
    amounts, units, irregular = defaultdict(int), defaultdict(int), defaultdict(int)
    window_keys = {month_key(m) for m in months}
    for when, (amount, kind) in zip(native, payments):
        key = month_key(when)
        if key not in window_keys:
            return {}, {}, {}, [_issue(o.raw_code, "FIX_OUTSIDE_WINDOW", f"Fixed payment {amount} falls in {key}, outside optimization window")]
        amounts[key] += amount
        if kind == BlockKind.A:
            units[key] += amount // o.unit
        else:
            irregular[key] += amount
    return dict(amounts), dict(units), dict(irregular), []


def _prevalidate_model(obligations: list[Obligation], config: EngineConfig) -> list[ValidationIssue]:
    issues: list[ValidationIssue] = []
    if config.optimization_start > config.zero_day:
        return [_issue("CONFIG", "WINDOW", "optimization_start is after zero_day")]
    months = months_between(config.optimization_start, config.zero_day)
    for o in obligations:
        earliest = max(month_start(config.optimization_start), o.start_month)
        latest = min(month_start(config.zero_day), o.native_end_month)
        if earliest > latest:
            issues.append(_issue(o.raw_code, "NO_ELIGIBLE_MONTH", "Obligation has no eligible month inside the optimization window"))
        if o.policy == Policy.FIX:
            _, _, _, fixed_issues = _fixed_schedule(o, config, months)
            issues.extend(fixed_issues)
    return issues


def optimize(obligations: list[Obligation], config: EngineConfig) -> OptimizationResult:
    issues = _prevalidate_model(obligations, config)
    if issues:
        return OptimizationResult(valid=False, solver="none", issues=issues)
    try:
        from ortools.sat.python import cp_model  # type: ignore
    except ImportError:
        return _optimize_fallback(obligations, config)
    return _optimize_cp_sat(obligations, config, cp_model)


def _optimize_cp_sat(obligations: list[Obligation], config: EngineConfig, cp_model) -> OptimizationResult:
    months = months_between(config.optimization_start, config.zero_day)
    keys = [month_key(m) for m in months]
    global_mt = sum(o.mt for o in obligations)
    model = cp_model.CpModel()

    fixed_by_ob: dict[str, dict[str, int]] = {}
    fixed_units: dict[str, dict[str, int]] = {}
    fixed_irregular: dict[str, dict[str, int]] = {}
    forced_irregular: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    xvars: dict[tuple[str, str], object] = {}

    for o in obligations:
        if o.policy == Policy.FIX:
            a, u, irr, _ = _fixed_schedule(o, config, months)
            fixed_by_ob[o.id], fixed_units[o.id], fixed_irregular[o.id] = a, u, irr
            continue

        earliest = max(month_start(config.optimization_start), o.start_month)
        latest = min(month_start(config.zero_day), o.native_end_month)
        eligible = [m for m in months if earliest <= m <= latest]

        if o.b_blocks:
            if config.frontload_b:
                forced_irregular[o.id][month_key(eligible[0])] += o.irregular_total
            else:
                cursor = 0
                for block in o.b_blocks:
                    for _ in range(block.count):
                        target = eligible[min(cursor, len(eligible) - 1)]
                        forced_irregular[o.id][month_key(target)] += block.amount
                        cursor += 1

        total_units = o.regular_units
        if total_units:
            yvars = []
            for idx, m in enumerate(eligible):
                key = month_key(m)
                x = model.NewIntVar(0, total_units, f"x_{o.id}_{key}")
                y = model.NewBoolVar(f"active_{o.id}_{key}")
                model.Add(x >= y)
                model.Add(x <= total_units * y)
                xvars[(o.id, key)] = x
                yvars.append(y)
                if idx:
                    model.Add(yvars[idx - 1] >= y)

            model.Add(yvars[0] == 1)
            model.Add(sum(xvars[(o.id, month_key(m))] for m in eligible) == total_units)

            if config.frontload_one_off and o.is_one_off:
                model.Add(xvars[(o.id, month_key(eligible[0]))] == total_units)

    month_total_vars = {}
    for m in months:
        key = month_key(m)
        constant, terms = 0, []
        for o in obligations:
            if o.policy == Policy.FIX:
                constant += fixed_by_ob.get(o.id, {}).get(key, 0)
            else:
                constant += forced_irregular[o.id].get(key, 0)
                if (o.id, key) in xvars:
                    terms.append(xvars[(o.id, key)] * o.unit)
        v = model.NewIntVar(0, global_mt, f"total_{key}")
        model.Add(v == ((sum(terms) + constant) if terms else constant))
        month_total_vars[key] = v

    if config.descending_load:
        for left, right in zip(keys, keys[1:]):
            model.Add(month_total_vars[left] >= month_total_vars[right])

    peak = model.NewIntVar(0, global_mt, "peak")
    minimum = model.NewIntVar(0, global_mt, "minimum")
    model.AddMaxEquality(peak, list(month_total_vars.values()))
    model.AddMinEquality(minimum, list(month_total_vars.values()))

    def solver_for_current_model():
        solver = cp_model.CpSolver()
        solver.parameters.max_time_in_seconds = 15.0
        solver.parameters.num_search_workers = 1
        solver.parameters.random_seed = 0
        return solver

    try:
        model.Minimize(peak)
        s1 = solver_for_current_model()
        status = s1.Solve(model)
        if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
            raise RuntimeError(f"peak phase failed: {status}")
        model.Add(peak == s1.Value(peak))

        model.Maximize(minimum)
        s2 = solver_for_current_model()
        status = s2.Solve(model)
        if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
            raise RuntimeError(f"leveling phase failed: {status}")
        model.Add(minimum == s2.Value(minimum))

        weights = {k: len(keys) - i for i, k in enumerate(keys)}
        front_expr = sum(
            xvars[(o.id, k)] * o.unit * weights[k]
            for o in obligations
            for k in keys
            if (o.id, k) in xvars
        )
        if xvars:
            model.Maximize(front_expr)
            s3 = solver_for_current_model()
            status = s3.Solve(model)
            if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
                raise RuntimeError(f"frontload phase failed: {status}")
            model.Add(front_expr == s3.Value(front_expr))

        model.Minimize(month_total_vars[keys[-1]])
        solver = solver_for_current_model()
        status = solver.Solve(model)
        if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
            raise RuntimeError(f"final-month phase failed: {status}")
    except RuntimeError as exc:
        return OptimizationResult(valid=False, solver="cp-sat", issues=[_issue("ENGINE", "INFEASIBLE", str(exc))])

    plans: list[ObligationPlan] = []
    monthly_totals = {k: 0 for k in keys}
    for o in sorted(obligations, key=lambda z: z.rank):
        allocs: list[MonthlyAllocation] = []
        for key in keys:
            amount = units = irregular = fixed = 0
            if o.policy == Policy.FIX:
                amount = fixed_by_ob.get(o.id, {}).get(key, 0)
                units = fixed_units.get(o.id, {}).get(key, 0)
                irregular = fixed_irregular.get(o.id, {}).get(key, 0)
                fixed = amount
            else:
                irregular = forced_irregular[o.id].get(key, 0)
                amount += irregular
                if (o.id, key) in xvars:
                    units = solver.Value(xvars[(o.id, key)])
                    amount += units * o.unit
            if amount:
                allocs.append(
                    MonthlyAllocation(
                        id=o.id,
                        entity=o.entity,
                        month=key,
                        amount=amount,
                        regular_units=units,
                        irregular_amount=irregular,
                        fixed_amount=fixed,
                    )
                )
                monthly_totals[key] += amount

        plan = ObligationPlan(
            id=o.id,
            entity=o.entity,
            mt=o.mt,
            unit=o.unit,
            policy=o.policy,
            allocations=allocs,
        )
        if plan.planned_total != o.mt:
            return OptimizationResult(
                valid=False,
                solver="cp-sat",
                issues=[_issue(o.raw_code, "PLAN_CHECKSUM", f"planned {plan.planned_total}, expected {o.mt}")],
            )
        plans.append(plan)

    return _finish("cp-sat", plans, obligations, config, monthly_totals)


def _optimize_fallback(obligations: list[Obligation], config: EngineConfig) -> OptimizationResult:
    months = months_between(config.optimization_start, config.zero_day)
    keys = [month_key(m) for m in months]
    monthly_totals = {k: 0 for k in keys}
    per_ob_amount = {o.id: {k: 0 for k in keys} for o in obligations}
    per_ob_units = {o.id: {k: 0 for k in keys} for o in obligations}
    per_ob_irregular = {o.id: {k: 0 for k in keys} for o in obligations}
    per_ob_fixed = {o.id: {k: 0 for k in keys} for o in obligations}
    acc: list[tuple[Obligation, list[str], int]] = []
    active_by_ob: dict[str, list[str]] = {}

    for o in obligations:
        if o.policy == Policy.FIX:
            amounts, units, irregular, fixed_issues = _fixed_schedule(o, config, months)
            if fixed_issues:
                return OptimizationResult(valid=False, solver="fallback-greedy", issues=fixed_issues)
            for k, v in amounts.items():
                per_ob_amount[o.id][k] += v
                monthly_totals[k] += v
                per_ob_fixed[o.id][k] += v
            for k, v in units.items():
                per_ob_units[o.id][k] += v
            for k, v in irregular.items():
                per_ob_irregular[o.id][k] += v
            continue

        earliest = max(month_start(config.optimization_start), o.start_month)
        latest = min(month_start(config.zero_day), o.native_end_month)
        eligible = [month_key(m) for m in months if earliest <= m <= latest]

        if o.b_blocks:
            if config.frontload_b:
                target = eligible[0]
                per_ob_amount[o.id][target] += o.irregular_total
                per_ob_irregular[o.id][target] += o.irregular_total
                monthly_totals[target] += o.irregular_total
            else:
                cursor = 0
                for block in o.b_blocks:
                    for _ in range(block.count):
                        target = eligible[min(cursor, len(eligible) - 1)]
                        per_ob_amount[o.id][target] += block.amount
                        per_ob_irregular[o.id][target] += block.amount
                        monthly_totals[target] += block.amount
                        cursor += 1

        if o.regular_units:
            acc.append((o, eligible, o.regular_units))

    extras: list[tuple[Obligation, list[str]]] = []
    for o, eligible, total_units in acc:
        if config.frontload_one_off and o.is_one_off:
            first = eligible[0]
            active_by_ob[o.id] = [first]
            per_ob_units[o.id][first] += total_units
            per_ob_amount[o.id][first] += total_units * o.unit
            monthly_totals[first] += total_units * o.unit
            continue

        active_count = min(total_units, len(eligible))
        active = eligible[:active_count]
        active_by_ob[o.id] = active
        for k in active:
            per_ob_units[o.id][k] += 1
            per_ob_amount[o.id][k] += o.unit
            monthly_totals[k] += o.unit
        for _ in range(total_units - active_count):
            extras.append((o, active))

    for o, active in sorted(extras, key=lambda item: (-item[0].unit, item[0].rank)):
        target = min(active, key=lambda k: (monthly_totals[k] + o.unit, keys.index(k)))
        per_ob_units[o.id][target] += 1
        per_ob_amount[o.id][target] += o.unit
        monthly_totals[target] += o.unit

    if config.descending_load:
        by_id = {o.id: o for o in obligations}
        for _ in range(1000):
            violation = next(
                (i for i in range(len(keys) - 1) if monthly_totals[keys[i]] < monthly_totals[keys[i + 1]]),
                None,
            )
            if violation is None:
                break
            left, right = keys[violation], keys[violation + 1]
            candidates = []
            for oid, active in active_by_ob.items():
                if left not in active or right not in active or per_ob_units[oid][right] <= 0:
                    continue
                r_index = active.index(right)
                later_positive = any(per_ob_units[oid][k] > 0 for k in active[r_index + 1:])
                if per_ob_units[oid][right] > 1 or not later_positive:
                    candidates.append(by_id[oid])
            if not candidates:
                break
            chosen = min(candidates, key=lambda o: (o.unit, o.rank))
            per_ob_units[chosen.id][right] -= 1
            per_ob_amount[chosen.id][right] -= chosen.unit
            monthly_totals[right] -= chosen.unit
            per_ob_units[chosen.id][left] += 1
            per_ob_amount[chosen.id][left] += chosen.unit
            monthly_totals[left] += chosen.unit

    plans: list[ObligationPlan] = []
    for o in sorted(obligations, key=lambda z: z.rank):
        allocs: list[MonthlyAllocation] = []
        for k in keys:
            amount = per_ob_amount[o.id][k]
            if amount:
                allocs.append(
                    MonthlyAllocation(
                        id=o.id,
                        entity=o.entity,
                        month=k,
                        amount=amount,
                        regular_units=per_ob_units[o.id][k],
                        irregular_amount=per_ob_irregular[o.id][k],
                        fixed_amount=per_ob_fixed[o.id][k],
                    )
                )
        plan = ObligationPlan(
            id=o.id,
            entity=o.entity,
            mt=o.mt,
            unit=o.unit,
            policy=o.policy,
            allocations=allocs,
        )
        if plan.planned_total != o.mt:
            return OptimizationResult(
                valid=False,
                solver="fallback-greedy",
                issues=[_issue(o.raw_code, "PLAN_CHECKSUM", f"planned {plan.planned_total}, expected {o.mt}")],
            )
        plans.append(plan)

    return _finish("fallback-greedy", plans, obligations, config, monthly_totals)


def _finish(
    solver: str,
    plans: list[ObligationPlan],
    obligations: list[Obligation],
    config: EngineConfig,
    monthly_totals: dict[str, int],
) -> OptimizationResult:
    global_mt = sum(o.mt for o in obligations)
    if sum(monthly_totals.values()) != global_mt:
        return OptimizationResult(
            valid=False,
            solver=solver,
            issues=[_issue("ENGINE", "GLOBAL_CHECKSUM", f"plan sums to {sum(monthly_totals.values())}, expected {global_mt}")],
        )

    values = list(monthly_totals.values())
    if config.descending_load and any(a < b for a, b in zip(values, values[1:])):
        return OptimizationResult(
            valid=False,
            solver=solver,
            issues=[_issue("ENGINE", "DESCENDING_LOAD", f"monthly load is not non-increasing: {values}")],
        )

    by_id = {o.id: o for o in obligations}
    all_months = [month_key(m) for m in months_between(config.optimization_start, config.zero_day)]
    for plan in plans:
        o = by_id[plan.id]
        if o.policy != Policy.ACC:
            continue
        regular_by_month = {a.month: a.regular_units for a in plan.allocations}
        positives = [i for i, key in enumerate(all_months) if regular_by_month.get(key, 0) > 0]
        if positives:
            first, last = min(positives), max(positives)
            if any(regular_by_month.get(all_months[i], 0) == 0 for i in range(first, last + 1)):
                return OptimizationResult(
                    valid=False,
                    solver=solver,
                    issues=[_issue(o.raw_code, "REGULAR_GAP", "accelerated regular schedule contains a gap before completion")],
                )

    days = days_inclusive(config.optimization_start, config.zero_day)
    metrics = OptimizationMetrics(
        global_mt=global_mt,
        peak_monthly=max(values),
        minimum_monthly=min(values),
        final_month=values[-1],
        average_per_day=round(global_mt / days, 2),
        days_in_window=days,
        monthly_totals=monthly_totals,
    )
    return OptimizationResult(valid=True, solver=solver, plans=plans, metrics=metrics)
