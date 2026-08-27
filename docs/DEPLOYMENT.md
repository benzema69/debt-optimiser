# Deployment runbook

## API
Python 3.12+ with OR-Tools.

```bash
cd apps/api
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Set `CORS_ORIGINS` to the deployed frontend origin.

## Web
```bash
cd apps/web
npm install
npm run build
npm start
```
Set `NEXT_PUBLIC_API_BASE_URL` to the API base URL.

## Supabase
Apply migrations from `supabase/migrations/` only after authentication/RLS policy decisions are confirmed for hosted personal data.
