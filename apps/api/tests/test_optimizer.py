from app.dsl import parse_code, parse_codes
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


def test_cp_sat_seed_optimum_is_locked_when_production_solver_is_available():
    obligations, _ = parse_codes(SEED_CODES)
    result = optimize(obligations, EngineConfig())
    if result.solver == "cp-sat":
        assert list(result.metrics.monthly_totals.values()) == [2951, 2921, 2921, 2921, 2921]
        assert result.metrics.peak_monthly == 2951
        assert result.metrics.minimum_monthly == 2921
        assert result.metrics.final_month == 2921


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


def test_acceleratable_one_off_is_fully_frontloaded():
    parsed = parse_code("C90-ONE-U100-ACC-1-1N300A-926127-MT300")
    assert parsed.valid
    result = optimize([parsed.obligation], EngineConfig(descending_load=False))
    assert result.valid
    plan = result.plans[0]
    assert len(plan.allocations) == 1
    assert plan.allocations[0].month == "2026-09"
    assert plan.allocations[0].regular_units == 3
    assert plan.allocations[0].amount == 300


def test_load_profile_is_non_increasing_by_default():
    obligations, _ = parse_codes(SEED_CODES)
    result = optimize(obligations, EngineConfig())
    values = list(result.metrics.monthly_totals.values())
    assert values == sorted(values, reverse=True)


def test_new_valid_code_reoptimizes_without_schema_changes():
    codes = [*SEED_CODES, "C14-XYZ-U80-ACC-5-5N80A-1026127-MT400"]
    obligations, issues = parse_codes(codes)
    assert not issues
    result = optimize(obligations, EngineConfig())
    assert result.valid
    assert result.metrics.global_mt == 15035
    added = next(p for p in result.plans if p.id == "C14")
    assert added.planned_total == 400
    assert all((a.amount - a.irregular_amount) % 80 == 0 for a in added.allocations)
