from __future__ import annotations

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .dsl import parse_code, parse_codes
from .models import CodesRequest, OptimizeRequest, ParseRequest, SimulateRequest
from .optimizer import optimize
from .seed import SEED_CODES, SEED_MT

app = FastAPI(title="Debt Optimiser API", version="1.0.0")

origins = [x.strip() for x in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",") if x.strip()]
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_credentials=True, allow_methods=["*"], allow_headers=["*"])


@app.get("/health")
def health():
    return {"ok": True, "service": "debt-optimiser-api", "version": "1.0.0"}


@app.get("/v1/seed")
def seed():
    return {"codes": SEED_CODES, "mt": SEED_MT}


@app.post("/v1/parse")
def parse(request: ParseRequest):
    return parse_code(request.code)


@app.post("/v1/validate")
def validate(request: CodesRequest):
    obligations, issues = parse_codes(request.codes)
    return {"valid": not issues, "issues": issues, "obligations": obligations}


@app.post("/v1/optimize")
def optimize_codes(request: OptimizeRequest):
    obligations, issues = parse_codes(request.codes)
    if issues:
        return {"valid": False, "solver": "none", "issues": issues, "plans": [], "metrics": None}
    return optimize(obligations, request.config)


@app.post("/v1/simulate")
def simulate(request: SimulateRequest):
    base_obligations, base_issues = parse_codes(request.codes)
    candidate = parse_code(request.candidate_code)
    issues = base_issues + candidate.issues
    if issues or not candidate.obligation:
        return {"valid": False, "issues": issues}
    before = optimize(base_obligations, request.config)
    after = optimize(base_obligations + [candidate.obligation], request.config)
    return {"valid": before.valid and after.valid, "candidate": candidate.obligation, "before": before, "after": after}
