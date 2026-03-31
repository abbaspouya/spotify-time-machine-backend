# Spotify Time Machine

Full-stack app for connecting a Spotify account, turning liked songs into time-based playlists, and moving library data between accounts with safer snapshot previews.

## Repo Layout

```text
Spotify/
  backend/
    app/
    requirements.txt
    .env
    .sessions/
    exports/
    tests/
  frontend/
    package.json
    src/
    scripts/
  .github/workflows/
  docs/
  README.md
```

## Local Setup

### Backend environment

Copy [backend/.env.example](backend/.env.example) to `backend/.env` and fill in your Spotify app credentials.

Important values:

- `SPOTIFY_CLIENT_ID`
- `SPOTIFY_CLIENT_SECRET`
- `SPOTIFY_REDIRECT_URI`
- `FRONTEND_URL`

Session and job settings can also be tuned in production:

- `SESSION_COOKIE_SECURE`
- `SESSION_COOKIE_SAMESITE`
- `SESSION_COOKIE_DOMAIN`
- `SESSION_COOKIE_MAX_AGE_SECONDS`
- `JOB_RETENTION_SECONDS`
- `LOG_LEVEL`

### Frontend environment

Copy [frontend/.env.example](frontend/.env.example) to `frontend/.env` if you want to override the backend URL.

## Install

Backend:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1 ( this one is to activate venv )
pip install -r backend/requirements.txt
```

Frontend:

```powershell
cd frontend
npm install
```

## Run

Backend:

```powershell
python -m uvicorn backend.app.main:app --reload --host 127.0.0.1 --port 8000
```

Frontend:

```powershell
cd frontend
npm run dev
```

Local URLs:

- Backend: `http://127.0.0.1:8000`
- Frontend: `http://127.0.0.1:5173`
- Swagger: `http://127.0.0.1:8000/docs`

## Main Product Flows

- `Connect Spotify`: browser-session-based Spotify OAuth and account status
- `Time Machine`: async grouping of liked songs into time slices and playlist creation
- `Transfer Library`: snapshot export job, import preview, destructive confirmation, and async import job
- `Advanced`: beta language grouping plus artist search

## Development Commands

Backend tests:

```powershell
python -m unittest discover -s backend/tests -p "test_*.py" -v
```

Frontend smoke test:

```powershell
cd frontend
npm run test:smoke
```

Frontend production build:

```powershell
cd frontend
npm run build
```

Backend syntax check:

```powershell
python -m compileall backend/app
```

## CI

GitHub Actions runs:

- backend unit tests
- backend compile check
- frontend smoke test
- frontend production build

Workflow: [ci.yml](.github/workflows/ci.yml)

## Deployment And Privacy

- Deployment guide: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)
- Privacy and data handling: [docs/PRIVACY.md](docs/PRIVACY.md)

## Notes

- The backend stores browser-session token data under `backend/.sessions/` for local and self-hosted use.
- Snapshot files can still be written to `backend/exports/`, but the frontend now defaults to browser download/upload flows.
- Internal auth callback routes are intentionally hidden from the public OpenAPI docs.
