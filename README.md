# Spotify

Full-stack repo layout with a FastAPI backend and a placeholder frontend workspace.

## Project Structure

```text
Spotify/
  backend/
    app/
    requirements.txt
    .env
    exports/
  frontend/
    package.json
    src/
  README.md
```

## Backend Prerequisites

- Python 3.10+
- Spotify app credentials

## Backend Environment Variables

Create or update `backend/.env`:

```env
SPOTIFY_CLIENT_ID=your_client_id
SPOTIFY_CLIENT_SECRET=your_client_secret
SPOTIFY_REDIRECT_URI=http://127.0.0.1:8000/callback
```

`SPOTIFY_REDIRECT_URI` must match the Redirect URI configured in your Spotify Developer dashboard.

## Install Backend Dependencies

From the repo root:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r backend/requirements.txt
```

## Run The Backend

From the repo root:

```powershell
python -m uvicorn backend.app.main:app --reload --host 127.0.0.1 --port 8000
```

Backend base URL: `http://127.0.0.1:8000/`

## Quick Check

- Health check: `GET http://127.0.0.1:8000/ping`
- Start Spotify auth flow: `GET http://127.0.0.1:8000/login`

## OAuth Scope Notes

This app uses read/write scopes for playlists, library, and follows for snapshot export/import.
If you previously authenticated with smaller scopes, delete `backend/.cache` and run `/login` again to refresh consent.

## Account Snapshot Export/Import

Use these endpoints to move playlists and library data between Spotify accounts.

### 1) Export snapshot

`POST /export_account_snapshot`

Example request:

```json
{
  "cutoff_date": "2026-02-23T00:00:00Z",
  "include_playlists": true,
  "include_liked_tracks": true,
  "include_saved_albums": true,
  "include_followed_artists": true,
  "write_to_file": true,
  "output_file_name": "my-source-account-snapshot.json",
  "return_snapshot": false
}
```

When `write_to_file=true`, the file is written under `backend/exports/`.

### 2) Import snapshot

Authenticate as the target account first, then call:
`POST /import_account_snapshot`

Example request:

```json
{
  "file_path": "backend/exports/my-source-account-snapshot.json",
  "import_playlists": true,
  "import_liked_tracks": true,
  "import_saved_albums": true,
  "import_followed_artists": true
}
```

The import endpoint also accepts `exports/my-source-account-snapshot.json` or just the file name when the snapshot exists inside `backend/exports/`.

## Frontend

`frontend/` is present as a placeholder workspace. Add your FE app there and keep backend/frontend concerns separated at the repo root.

## Development Notes

Git workflow and commit prefix conventions are documented in `CONTRIBUTING.md`.
