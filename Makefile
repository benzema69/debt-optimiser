api:
	uvicorn app.main:app --app-dir apps/api --reload --port 8000
web:
	cd apps/web && npm run dev
test:
	pytest apps/api/tests
.PHONY: api web test
