# Deployment Guide

## Recommended Setup

- Deploy the FastAPI backend behind HTTPS.
- Deploy the frontend on a stable public origin.
- Set `FRONTEND_URL` to the public frontend base URL.
- Set `SPOTIFY_REDIRECT_URI` to the public backend callback URL registered in the Spotify Developer dashboard.

## Production Environment Checklist

Backend:

- `SPOTIFY_CLIENT_ID`
- `SPOTIFY_CLIENT_SECRET`
- `SPOTIFY_REDIRECT_URI`
- `FRONTEND_URL`
- `CORS_ALLOW_ORIGINS`
- `SESSION_COOKIE_SECURE=true`
- `SESSION_COOKIE_SAMESITE=lax` or `none`
- `SESSION_COOKIE_DOMAIN` when using a shared parent domain
- `SESSION_COOKIE_MAX_AGE_SECONDS`
- `JOB_RETENTION_SECONDS`
- `LOG_LEVEL=INFO`

Frontend:

- `VITE_API_BASE_URL`

## Cookie Guidance

- Use `SESSION_COOKIE_SECURE=true` in production.
- If `SESSION_COOKIE_SAMESITE=none`, secure cookies are required.
- Prefer `lax` unless your frontend/backend deployment shape truly needs `none`.

## Runtime Operations

- Request logs include `request_id`, method, path, status, and duration.
- Error responses include a `request_id` so frontend and backend troubleshooting can line up quickly.
- Async grouping/export/import work is exposed through job polling endpoints.
- Session files are stored under `backend/.sessions/`; treat that directory as sensitive runtime state.

## Deployment Verification

1. Run backend tests: `python -m unittest discover -s backend/tests -p "test_*.py" -v`
2. Run backend compile check: `python -m compileall backend/app`
3. Run frontend smoke test: `npm run test:smoke`
4. Run frontend build: `npm run build`
5. Confirm `/ping` returns `{"status":"ok"}`
6. Confirm `/docs` loads and internal callback routes are not listed
7. Walk through login, time grouping, snapshot preview, and snapshot import in a staging environment
