from __future__ import annotations

import re
from datetime import date

from .models import BlockKind, Obligation, ParseResult, PaymentBlock, Policy, ValidationIssue

ID_RE = re.compile(r"^C(?P<rank>[1-9]\d*)$")
ENTITY_RE = re.compile(r"^[A-Z][A-Z0-9]{1,11}$")
UNIT_RE = re.compile(r"^U(?P<unit>[1-9]\d*)$")
BLOCK_RE = re.compile(r"^(?P<count>[1-9]\d*)N(?P<amount>[1-9]\d*)(?P<kind>[AB])$")
MT_RE = re.compile(r"^MT(?P<mt>[1-9]\d*)$")


def _issue(code: str, error: str, detail: str) -> ValidationIssue:
    return ValidationIssue(code=code, error=error, detail=detail)


def _parse_myy(part: str) -> date | None:
    if len(part) not in (3, 4) or not part.isdigit():
        return None
    month_text, yy_text = part[:-2], part[-2:]
    if month_text.startswith("0"):
        return None
    month = int(month_text)
    year = 2000 + int(yy_text)
    if not 1 <= month <= 12:
        return None
    return date(year, month, 1)


def parse_period(token: str) -> tuple[date, date]:
    candidates: list[tuple[date, date]] = []
    for cut in (3, 4):
        left, right = token[:cut], token[cut:]
        a, b = _parse_myy(left), _parse_myy(right)
        if a and b:
            candidates.append((a, b))
    if len(candidates) != 1:
        raise ValueError(f"ambiguous or invalid compact period token: {token}")
    return candidates[0]


def parse_code(code: str) -> ParseResult:
    raw = code.strip()
    parts = raw.split("-")
    issues: list[ValidationIssue] = []
    if len(parts) < 8:
        return ParseResult(valid=False, issues=[_issue(raw, "TOKEN_COUNT", "Expected at least 8 hyphen-separated tokens")])

    id_token, entity, unit_token, policy_token, count_token = parts[:5]
    period_token, mt_token = parts[-2:]
    block_tokens = parts[5:-2]

    id_match = ID_RE.match(id_token)
    if not id_match:
        issues.append(_issue(raw, "ID_SYNTAX", f"Invalid ID token: {id_token}"))
    if not ENTITY_RE.match(entity):
        issues.append(_issue(raw, "ENTITY_SYNTAX", f"Invalid entity token: {entity}"))
    unit_match = UNIT_RE.match(unit_token)
    if not unit_match:
        issues.append(_issue(raw, "UNIT_SYNTAX", f"Invalid unit token: {unit_token}"))
    try:
        policy = Policy(policy_token)
    except ValueError:
        policy = None
        issues.append(_issue(raw, "POLICY", f"Policy must be ACC or FIX, got {policy_token}"))
    try:
        payment_count = int(count_token)
        if payment_count <= 0:
            raise ValueError
    except ValueError:
        payment_count = 0
        issues.append(_issue(raw, "PAYMENT_COUNT", f"Invalid payment count: {count_token}"))

    blocks: list[PaymentBlock] = []
    if not block_tokens:
        issues.append(_issue(raw, "BLOCKS", "At least one payment block is required"))
    for token in block_tokens:
        m = BLOCK_RE.match(token)
        if not m:
            issues.append(_issue(raw, "BLOCK_SYNTAX", f"Invalid payment block: {token}"))
            continue
        blocks.append(PaymentBlock(count=int(m.group("count")), amount=int(m.group("amount")), kind=BlockKind(m.group("kind"))))

    try:
        start, native_end = parse_period(period_token)
        if start > native_end:
            issues.append(_issue(raw, "DATE_ORDER", "Start month is after native end month"))
    except ValueError as exc:
        start = native_end = date(2000, 1, 1)
        issues.append(_issue(raw, "PERIOD", str(exc)))

    mt_match = MT_RE.match(mt_token)
    if not mt_match:
        mt = 0
        issues.append(_issue(raw, "MT_SYNTAX", f"Invalid total token: {mt_token}"))
    else:
        mt = int(mt_match.group("mt"))

    if issues:
        return ParseResult(valid=False, issues=issues)

    unit = int(unit_match.group("unit"))
    encoded_count = sum(b.count for b in blocks)
    if encoded_count != payment_count:
        issues.append(_issue(raw, "COUNT_ERROR", f"Payment count declares {payment_count}, blocks encode {encoded_count}"))
    checksum = sum(b.total for b in blocks)
    if checksum != mt:
        issues.append(_issue(raw, "CHECKSUM_ERROR", f"MT={mt}, payment blocks sum to {checksum}"))
    for block in blocks:
        if block.kind == BlockKind.A and block.amount % unit != 0:
            issues.append(_issue(raw, "A_NOT_MULTIPLE_OF_U", f"A amount {block.amount} is not an integer multiple of U={unit}"))

    if issues:
        return ParseResult(valid=False, issues=issues)

    obligation = Obligation(raw_code=raw, id=id_token, rank=int(id_match.group("rank")), entity=entity, unit=unit, policy=policy, payment_count=payment_count, blocks=blocks, start_month=start, native_end_month=native_end, mt=mt)
    return ParseResult(valid=True, obligation=obligation)


def parse_codes(codes: list[str]) -> tuple[list[Obligation], list[ValidationIssue]]:
    obligations: list[Obligation] = []
    issues: list[ValidationIssue] = []
    seen: dict[str, str] = {}
    for code in codes:
        result = parse_code(code)
        issues.extend(result.issues)
        if result.obligation:
            if result.obligation.id in seen:
                issues.append(_issue(code, "DUPLICATE_ID", f"{result.obligation.id} already used by {seen[result.obligation.id]}"))
            else:
                seen[result.obligation.id] = code
                obligations.append(result.obligation)
    if issues:
        invalid_codes = {i.code for i in issues if i.severity == "ERROR"}
        obligations = [o for o in obligations if o.raw_code not in invalid_codes]
    return obligations, issues
