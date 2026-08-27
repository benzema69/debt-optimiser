from app.dsl import parse_code, parse_codes, parse_period


def test_period_compact_formats():
    assert str(parse_period("926727")[0]) == "2026-09-01"
    assert str(parse_period("926727")[1]) == "2027-07-01"
    assert str(parse_period("9261126")[1]) == "2026-11-01"


def test_valid_bcv():
    result = parse_code("C1-BCV-U300-ACC-11-10N300A-1N160B-926727-MT3160")
    assert result.valid
    o = result.obligation
    assert o is not None and o.unit == 300 and o.regular_units == 10 and o.irregular_total == 160


def test_lml_atomic_unit_expansion():
    result = parse_code("C4-LML-U130-ACC-5-3N390A-2N260B-926127-MT1690")
    assert result.valid
    assert result.obligation.regular_units == 9
    assert result.obligation.irregular_total == 520


def test_fractional_a_rejected():
    result = parse_code("C1-XYZ-U80-ACC-1-1N100A-926926-MT100")
    assert not result.valid
    assert any(i.error == "A_NOT_MULTIPLE_OF_U" for i in result.issues)


def test_checksum_rejected():
    result = parse_code("C1-XYZ-U100-ACC-2-2N100A-9261026-MT250")
    assert not result.valid
    assert any(i.error == "CHECKSUM_ERROR" for i in result.issues)


def test_duplicate_ids_rejected():
    codes = ["C1-AAA-U100-ACC-1-1N100A-926926-MT100", "C1-BBB-U100-ACC-1-1N100A-926926-MT100"]
    _, issues = parse_codes(codes)
    assert any(i.error == "DUPLICATE_ID" for i in issues)
