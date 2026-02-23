# Spotify Backend (FastAPI)

## Prerequisites
- Python 3.10+
- Spotify app credentials

## Environment Variables
Create or update `.env` in the project root:

```env
SPOTIFY_CLIENT_ID=your_client_id
SPOTIFY_CLIENT_SECRET=your_client_secret
SPOTIFY_REDIRECT_URI=http://127.0.0.1:8000/callback
```

`SPOTIFY_REDIRECT_URI` must match the Redirect URI configured in your Spotify Developer dashboard.

## Install Dependencies
Optional but recommended:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

Install packages:

```powershell
pip install -r requirements.txt
```

## Run The Backend
From the project root:

```powershell
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

## Quick Check
- Health check: `GET http://127.0.0.1:8000/ping`
- Start Spotify auth flow: `GET http://127.0.0.1:8000/login`
