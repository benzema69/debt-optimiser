from __future__ import annotations

from datetime import date
from enum import Enum
from typing import Literal

from pydantic import BaseModel, Field


class Policy(str, Enum):
    ACC = "ACC"
    FIX = "FIX"


class BlockKind(str, Enum):
    A = "A"
    B = "B"


class PaymentBlock(BaseModel):
    count: int = Field(gt=0)
    amount: int = Field(gt=0)
    kind: BlockKind

    @property
    def total(self) -> int:
        return self.count * self.amount


class Obligation(BaseModel):
    raw_code: str
    id: str
    rank: int
    entity: str
    unit: int = Field(gt=0)
    policy: Policy
    payment_count: int = Field(gt=0)
    blocks: list[PaymentBlock]
    start_month: date
    native_end_month: date
    mt: int = Field(gt=0)

    @property
    def a_blocks(self) -> list[PaymentBlock]:
        return [b for b in self.blocks if b.kind == BlockKind.A]

    @property
    def b_blocks(self) -> list[PaymentBlock]:
        return [b for b in self.blocks if b.kind == BlockKind.B]

    @property
    def regular_units(self) -> int:
        return sum(b.total // self.unit for b in self.a_blocks)

    @property
    def irregular_total(self) -> int:
        return sum(b.total for b in self.b_blocks)

    @property
    def is_one_off(self) -> bool:
        return self.payment_count == 1


class ValidationIssue(BaseModel):
    code: str
    severity: Literal["ERROR", "WARNING"] = "ERROR"
    error: str
    detail: str


class ParseResult(BaseModel):
    valid: bool
    obligation: Obligation | None = None
    issues: list[ValidationIssue] = Field(default_factory=list)


class EngineConfig(BaseModel):
    optimization_start: date = date(2026, 9, 1)
    zero_day: date = date(2027, 1, 31)
    frontload_b: bool = True
    frontload_one_off: bool = True
    descending_load: bool = True


class MonthlyAllocation(BaseModel):
    id: str
    entity: str
    month: str
    amount: int
    regular_units: int = 0
    irregular_amount: int = 0
    fixed_amount: int = 0


class ObligationPlan(BaseModel):
    id: str
    entity: str
    mt: int
    unit: int
    policy: Policy
    allocations: list[MonthlyAllocation]

    @property
    def planned_total(self) -> int:
        return sum(x.amount for x in self.allocations)


class OptimizationMetrics(BaseModel):
    global_mt: int
    peak_monthly: int
    minimum_monthly: int
    final_month: int
    average_per_day: float
    days_in_window: int
    monthly_totals: dict[str, int]


class OptimizationResult(BaseModel):
    valid: bool
    solver: str
    issues: list[ValidationIssue] = Field(default_factory=list)
    plans: list[ObligationPlan] = Field(default_factory=list)
    metrics: OptimizationMetrics | None = None


class CodesRequest(BaseModel):
    codes: list[str]


class OptimizeRequest(CodesRequest):
    config: EngineConfig = Field(default_factory=EngineConfig)


class ParseRequest(BaseModel):
    code: str


class SimulateRequest(BaseModel):
    codes: list[str]
    candidate_code: str
    config: EngineConfig = Field(default_factory=EngineConfig)
