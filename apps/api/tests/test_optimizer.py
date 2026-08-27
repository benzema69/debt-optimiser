from app.dsl import parse_codes
from app.models import EngineConfig, Policy
from app.optimizer import optimize
from app.seed import SEED_CODES, SEED_MT


def test_seed_checksum_and_zero_day_plan():
    obligations, issues = parse_codes(SEED_CODES)
    assert not issues
    assert sum(o.mt for o in obligations) == SEED_MT == 14635
    result = optimize(obligations, EngineConfig())
    assert result.valid, result.issues
    assert result.metrics.global_mt == 14635
    assert result.metrics.days_in_window == 153
    assert round(result.metrics.average_per_day, 2) == 95.65
    assert set(result.metrics.monthly_totals) == {"2026-09", "2026-10", "2026-11", "2026-12", "2027-01"}
    assert sum(result.metrics.monthly_totals.values()) == 14635
    assert all(p.planned_total == p.mt for p in result.plans)


def test_regular_allocations_are_integer_units():
    obligations, _ = parse_codes(SEED_CODES)
    result = optimize(obligations, EngineConfig())
    by_id = {o.id: o for o in obligations}
    for plan in result.plans:
        if plan.policy == Policy.ACC:
            unit = by_id[plan.id].unit
            for a in plan.allocations:
                regular = a.amount - a.irregular_amount
                assert regular % unit == 0


def test_fixed_rent_is_600_each_month():
    obligations, _ = parse_codes(SEED_CODES)
    result = optimize(obligations, EngineConfig())
    rent = next(p for p in result.plans if p.entity == "LOY")
    assert [a.amount for a in rent.allocations] == [600, 600, 600, 600, 600]


def test_irregular_atoms_frontload_to_september():
    obligations, _ = parse_codes(SEED_CODES)
    result = optimize(obligations, EngineConfig())
    for entity in ("BCV", "LML", "CFF2"):
        plan = next(p for p in result.plans if p.entity == entity)
        irr = [a for a in plan.allocations if a.irregular_amount]
        assert irr and all(a.month == "2026-09" for a in irr)
