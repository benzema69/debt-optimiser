from __future__ import annotations

from collections import Counter
from datetime import date

from .models import BlockKind, EngineConfig, Obligation, PaymentBlock, Policy, ValidationIssue


def _issue(code: str, error: str, detail: str) -> ValidationIssue:
    return ValidationIssue(code=code, error=error, detail=detail)


def _month_start(d: date) -> date:
    return date(d.year, d.month, 1)


def _add_month(d: date, n: int = 1) -> date:
    y = d.year + (d.month - 1 + n) // 12
    m = (d.month - 1 + n) % 12 + 1
    return date(y, m, 1)


def _native_months(o: Obligation) -> list[date]:
    out: list[date] = []
    cur = _month_start(o.start_month)
    end = _month_start(o.native_end_month)
    while cur <= end:
        out.append(cur)
        cur = _add_month(cur)
    return out


def _reconcile_acc(o: Obligation, paid: int, config: EngineConfig) -> tuple[Obligation | None, dict, list[ValidationIssue]]:
    if paid == 0:
        return o, {"id": o.id, "paid": 0, "remaining": o.mt, "regular_units_paid": 0, "irregular_paid": 0}, []
    if paid == o.mt:
        return None, {"id": o.id, "paid": paid, "remaining": 0, "regular_units_paid": o.regular_units, "irregular_paid": o.irregular_total}, []

    atoms: list[int] = []
    for block in o.b_blocks:
        atoms.extend([block.amount] * block.count)

    # Dynamic subset sums for irregular atoms. For each reachable sum, retain one
    # deterministic set of atom indexes. We then maximize irregular amount consumed,
    # consistent with the engine's front-load-B policy, while requiring the rest of
    # the payment to be an integer number of regular U units.
    states: dict[int, tuple[int, ...]] = {0: ()}
    for idx, amount in enumerate(atoms):
        nxt = dict(states)
        for total, chosen in states.items():
            candidate = total + amount
            if candidate <= paid and candidate not in nxt:
                nxt[candidate] = chosen + (idx,)
        states = nxt

    candidates: list[tuple[int, int, tuple[int, ...]]] = []
    for irr_sum, chosen in states.items():
        regular_cash = paid - irr_sum
        if regular_cash < 0 or regular_cash % o.unit:
            continue
        units = regular_cash // o.unit
        if units <= o.regular_units:
            candidates.append((irr_sum, units, chosen))

    if not candidates:
        return None, {}, [_issue(o.raw_code, "PAYMENT_NOT_REPRESENTABLE", f"Paid amount {paid} cannot be represented as irregular atoms plus integer U={o.unit} units")]

    irr_paid, units_paid, chosen = max(candidates, key=lambda x: (x[0], x[1]))
    chosen_set = set(chosen)
    remaining_atom_counts = Counter(amount for idx, amount in enumerate(atoms) if idx not in chosen_set)
    remaining_units = o.regular_units - units_paid
    remaining = o.mt - paid

    blocks: list[PaymentBlock] = []
    if remaining_units:
        blocks.append(PaymentBlock(count=remaining_units, amount=o.unit, kind=BlockKind.A))
    for amount in sorted(remaining_atom_counts):
        count = remaining_atom_counts[amount]
        if count:
            blocks.append(PaymentBlock(count=count, amount=amount, kind=BlockKind.B))

    if sum(b.total for b in blocks) != remaining:
        return None, {}, [_issue(o.raw_code, "RECONCILE_CHECKSUM", f"Remaining blocks sum to {sum(b.total for b in blocks)}, expected {remaining}")]

    reduced = Obligation(
        raw_code=f"{o.raw_code}#remaining={remaining}",
        id=o.id,
        rank=o.rank,
        entity=o.entity,
        unit=o.unit,
        policy=o.policy,
        payment_count=sum(b.count for b in blocks),
        blocks=blocks,
        start_month=max(o.start_month, _month_start(config.optimization_start)),
        native_end_month=o.native_end_month,
        mt=remaining,
    )
    return reduced, {
        "id": o.id,
        "paid": paid,
        "remaining": remaining,
        "regular_units_paid": units_paid,
        "irregular_paid": irr_paid,
    }, []


def _reconcile_fix(o: Obligation, paid: int, config: EngineConfig) -> tuple[Obligation | None, dict, list[ValidationIssue]]:
    payments: list[tuple[int, BlockKind]] = []
    for block in o.blocks:
        payments.extend([(block.amount, block.kind)] * block.count)
    native = _native_months(o)
    if len(payments) != len(native):
        return None, {}, [_issue(o.raw_code, "FIX_MAPPING", "Cannot reconcile FIX obligation because encoded payments do not map one-to-one to native months")]
    if paid == 0:
        return o, {"id": o.id, "paid": 0, "remaining": o.mt, "regular_units_paid": 0, "irregular_paid": 0}, []
    if paid == o.mt:
        return None, {"id": o.id, "paid": paid, "remaining": 0, "regular_units_paid": o.regular_units, "irregular_paid": o.irregular_total}, []

    running = 0
    consumed = None
    for idx, (amount, _kind) in enumerate(payments, start=1):
        running += amount
        if running == paid:
            consumed = idx
            break
        if running > paid:
            break
    if consumed is None:
        return None, {}, [_issue(o.raw_code, "FIX_PAYMENT_NOT_PREFIX", f"Paid amount {paid} is not an exact prefix of the fixed native schedule")]

    remaining_payments = payments[consumed:]
    remaining = o.mt - paid
    blocks = [PaymentBlock(count=1, amount=amount, kind=kind) for amount, kind in remaining_payments]
    if sum(b.total for b in blocks) != remaining:
        return None, {}, [_issue(o.raw_code, "RECONCILE_CHECKSUM", f"Remaining fixed blocks sum to {sum(b.total for b in blocks)}, expected {remaining}")]

    reduced = Obligation(
        raw_code=f"{o.raw_code}#remaining={remaining}",
        id=o.id,
        rank=o.rank,
        entity=o.entity,
        unit=o.unit,
        policy=Policy.FIX,
        payment_count=len(blocks),
        blocks=blocks,
        start_month=native[consumed],
        native_end_month=o.native_end_month,
        mt=remaining,
    )
    return reduced, {
        "id": o.id,
        "paid": paid,
        "remaining": remaining,
        "regular_units_paid": 0,
        "irregular_paid": 0,
        "fixed_prefix_payments_paid": consumed,
    }, []


def reconcile_obligations(
    obligations: list[Obligation],
    paid_by_id: dict[str, int],
    config: EngineConfig,
) -> tuple[list[Obligation], list[dict], list[ValidationIssue]]:
    known = {o.id for o in obligations}
    issues: list[ValidationIssue] = []
    for oid, amount in paid_by_id.items():
        if oid not in known:
            issues.append(_issue(oid, "UNKNOWN_PAYMENT_ID", "Payment references an obligation ID not present in the source code set"))
        if amount < 0:
            issues.append(_issue(oid, "NEGATIVE_PAYMENT", "Paid-to-date cannot be negative"))
    if issues:
        return [], [], issues

    remaining: list[Obligation] = []
    summary: list[dict] = []
    for o in obligations:
        paid = int(paid_by_id.get(o.id, 0))
        if paid > o.mt:
            issues.append(_issue(o.raw_code, "OVERPAYMENT", f"Paid-to-date {paid} exceeds MT={o.mt}"))
            continue
        if o.policy == Policy.FIX:
            reduced, item, local_issues = _reconcile_fix(o, paid, config)
        else:
            reduced, item, local_issues = _reconcile_acc(o, paid, config)
        issues.extend(local_issues)
        if item:
            summary.append(item)
        if reduced:
            remaining.append(reduced)

    if issues:
        return [], summary, issues
    return remaining, summary, []
