from datetime import date

from app.dsl import parse_codes
from app.models import EngineConfig
from app.optimizer import optimize
from app.reconcile import reconcile_obligations
from app.seed import SEED_CODES, SEED_MT


def _seed():
    obligations, issues = parse_codes(SEED_CODES)
    assert not issues
    return obligations


def test_bcv_regular_only_payment_keeps_irregular_atom():
    remaining, summary, issues = reconcile_obligations(_seed(), {"C1": 300}, EngineConfig())
    assert not issues
    bcv = next(o for o in remaining if o.id == "C1")
    assert bcv.mt == 2860
    assert bcv.regular_units == 9
    assert bcv.irregular_total == 160
    row = next(x for x in summary if x["id"] == "C1")
    assert row["regular_units_paid"] == 1
    assert row["irregular_paid"] == 0


def test_bcv_combined_payment_consumes_b_first_when_representable():
    remaining, summary, issues = reconcile_obligations(_seed(), {"C1": 460}, EngineConfig())
    assert not issues
    bcv = next(o for o in remaining if o.id == "C1")
    assert bcv.mt == 2700
    assert bcv.regular_units == 9
    assert bcv.irregular_total == 0
    row = next(x for x in summary if x["id"] == "C1")
    assert row["regular_units_paid"] == 1
    assert row["irregular_paid"] == 160


def test_lamal_reconciliation_respects_atomic_u():
    remaining, summary, issues = reconcile_obligations(_seed(), {"C4": 390}, EngineConfig())
    assert not issues
    lml = next(o for o in remaining if o.id == "C4")
    assert lml.mt == 1300
    assert lml.regular_units == 8
    assert lml.irregular_total == 260
    row = next(x for x in summary if x["id"] == "C4")
    assert row["irregular_paid"] == 260
    assert row["regular_units_paid"] == 1


def test_fixed_payment_must_be_exact_native_prefix():
    remaining, _, issues = reconcile_obligations(_seed(), {"C2": 600}, EngineConfig())
    assert not issues
    rent = next(o for o in remaining if o.id == "C2")
    assert rent.mt == 2400
    assert rent.start_month == date(2026, 10, 1)
    assert rent.payment_count == 4

    _, _, issues = reconcile_obligations(_seed(), {"C2": 300}, EngineConfig())
    assert issues
    assert issues[0].error == "FIX_PAYMENT_NOT_PREFIX"


def test_nonrepresentable_acc_payment_is_rejected():
    _, _, issues = reconcile_obligations(_seed(), {"C1": 100}, EngineConfig())
    assert issues
    assert issues[0].error == "PAYMENT_NOT_REPRESENTABLE"


def test_fully_paid_obligation_is_removed_and_remaining_reoptimizes():
    paid = {"C13": 70, "C1": 460, "C2": 600}
    remaining, _, issues = reconcile_obligations(_seed(), paid, EngineConfig())
    assert not issues
    assert all(o.id != "C13" for o in remaining)
    assert sum(o.mt for o in remaining) == SEED_MT - sum(paid.values())
    result = optimize(remaining, EngineConfig())
    assert result.valid, result.issues
    assert result.metrics is not None
    assert result.metrics.global_mt == SEED_MT - sum(paid.values())
