# Spotify Time Machine

Spotify Time Machine is a full-stack Spotify library utility for creating time-based playlists, moving selected library data between accounts, and experimenting with beta language-based playlist creation.

It is built as a usable self-hosted app: clone it, create your own Spotify Developer app, add your credentials to `.env`, and run it locally. It also works well as a portfolio-quality engineering and product-design case study because the full product lives in this repository.

![Spotify Time Machine landing page](docs/showcase/screenshots/landing.png)

## What It Does

- **Time Machine**: group liked songs by month, quarter, half-year, or year, then create a playlist from the selected time slice.
- **Transfer Library**: export a snapshot from one Spotify account, preview what will be imported into another account, and apply only the selected data.
- **One Playlist Move**: add one playlist into Liked Songs or another playlist in the connected import account.
- **Language Playlists Beta**: scan liked songs with `langdetect`, choose a detected language group, and create a playlist from it.
- **Dashboard Recap**: view top tracks after login, with Spotify rate-limit handling.

## Screenshots

| Landing | Time Machine |
| --- | --- |
| ![Landing page](docs/showcase/screenshots/landing.png) | ![Time Machine workflow](docs/showcase/screenshots/time-machine.png) |

| Transfer Library | Language Playlists |
| --- | --- |
| ![Transfer Library workflow](docs/showcase/screenshots/transfer-library.png) | ![Language Playlists beta workflow](docs/showcase/screenshots/language-playlists.png) |

More showcase notes live in [docs/showcase](docs/showcase/README.md).

## Why It Exists

Spotify libraries can become personal archives: years of liked songs, playlists, albums, and followed artists. The hard part is not listening; it is reshaping that library when you want to revisit a period of time, move to another account, or create a playlist around a specific type of music.

This app turns those jobs into focused workflows:

1. Connect Spotify.
2. Choose the job you want to do.
3. Preview or select the result before the app writes anything meaningful back to Spotify.

## Use It Yourself

This is not a hosted public SaaS. If you want to use it, you run your own local copy and connect it to your own Spotify Developer app credentials.

Current Spotify platform notes:

- Spotify's Web API documentation says you need a Spotify Premium account to use the Web API; for development-mode apps, Spotify also notes that the app owner must have Premium.
- Newly created Spotify apps start in development mode. Spotify documents this mode as suitable for apps under construction or apps that manage one account.
- In development mode, Spotify currently allows up to 5 authenticated users, and each user has to be added to the app allowlist before API calls work for them.
- If you deploy the app for a wider audience, review Spotify's quota modes, policy, and terms first.

Useful official links:

- [Spotify Web API](https://developer.spotify.com/documentation/web-api)
- [Spotify Apps guide](https://developer.spotify.com/documentation/web-api/concepts/apps)
- [Spotify Redirect URIs guide](https://developer.spotify.com/documentation/web-api/concepts/redirect_uri)
- [Spotify Authorization Code Flow](https://developer.spotify.com/documentation/web-api/tutorials/code-flow)
- [Spotify Quota Modes](https://developer.spotify.com/documentation/web-api/concepts/quota-modes)

## Product Notes

This project is not positioned as a commercial product. Spotify's platform has development-mode access, quota extension review, rate limits, and policy requirements for apps that use Spotify APIs. For the current official guidance, see Spotify's [Quota Modes](https://developer.spotify.com/documentation/web-api/concepts/quota-modes), [Developer Policy](https://developer.spotify.com/policy), and [Developer Terms](https://developer.spotify.com/terms).

The practical result: this repository is best used as a self-hosted personal tool, local demo, and portfolio project.

## Tech Stack

**Frontend**

- React 19
- TypeScript
- Vite
- Tailwind CSS
- TanStack Query
- React Router
- Lucide icons

**Backend**

- Python
- FastAPI
- Spotipy
- `langdetect`
- Browser-session Spotify OAuth
- In-memory async job registry with session-scoped job access

## Architecture Highlights

- **Spotify OAuth with account roles**: source and target accounts can be connected separately for transfer workflows.
- **Session-scoped jobs**: long-running grouping, export, and import work runs as async jobs tied to the browser session.
- **Snapshot workflow**: transfer data can be exported as JSON, previewed, and imported with destructive-operation warnings.
- **Rate-limit handling**: Spotify `429` responses are surfaced in the UI with cooldown messaging.
- **Privacy-conscious local storage**: local sessions are stored under `backend/.sessions/` for self-hosted development.

## Repo Layout

```text
spotify-time-machine/
  backend/
    app/
    requirements.txt
    .env.example
    tests/
  frontend/
    src/
    scripts/
    package.json
  docs/
    showcase/
    DEPLOYMENT.md
    PRIVACY.md
  docker-compose.yml
  docker-compose.demo.yml
  .github/workflows/
  README.md
```

## Local Setup

### 1. Create A Spotify Developer App

1. Go to the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard).
2. Log in with the Spotify account you want to use as the app owner.
3. Create a new app.
4. Choose **Web API** when Spotify asks which API or SDK you plan to use.
5. Open the app settings and add this redirect URI:

```text
http://127.0.0.1:8000/callback
```

Spotify's redirect URI rules require an exact match. For local development, use `127.0.0.1` rather than `localhost`.

6. Copy the app's **Client ID** and **Client Secret**. Keep the client secret private.

If another person wants to use your development-mode app, add their Spotify account in the app's user allowlist in the Spotify Developer Dashboard.

### Backend Environment

Copy [backend/.env.example](backend/.env.example) to `backend/.env` and fill in your Spotify app credentials.

PowerShell:

```powershell
Copy-Item backend/.env.example backend/.env
```

Important values:

- `SPOTIFY_CLIENT_ID`
- `SPOTIFY_CLIENT_SECRET`
- `SPOTIFY_REDIRECT_URI`
- `FRONTEND_URL`

Session and job settings can also be tuned:

- `SESSION_COOKIE_SECURE`
- `SESSION_COOKIE_SAMESITE`
- `SESSION_COOKIE_DOMAIN`
- `SESSION_COOKIE_MAX_AGE_SECONDS`
- `JOB_RETENTION_SECONDS`
- `LOG_LEVEL`

Example local backend `.env`:

```env
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
SPOTIFY_REDIRECT_URI=http://127.0.0.1:8000/callback
FRONTEND_URL=http://127.0.0.1:5173
```

Do not commit your real `.env` file. The repository includes `.env.example` files for documentation, while real `.env` files are ignored.

The Spotify client secret belongs only in `backend/.env`. Do not put it in the frontend environment, screenshots, commits, issues, or public posts.

### Frontend Environment

Copy [frontend/.env.example](frontend/.env.example) to `frontend/.env` if you want to override the backend URL.

PowerShell:

```powershell
Copy-Item frontend/.env.example frontend/.env
```

Example local frontend `.env`:

```env
VITE_API_BASE_URL=http://127.0.0.1:8000
VITE_DEMO_MODE=false
```

## Demo Mode

Demo mode lets people explore the UI without Spotify credentials. It uses sample data in the frontend and does not call the backend or Spotify.

For local frontend development, set this in `frontend/.env`:

```env
VITE_DEMO_MODE=true
VITE_API_BASE_URL=http://127.0.0.1:8000
```

Then run only the frontend:

```powershell
cd frontend
npm run dev
```

Open `http://127.0.0.1:5173` and use the demo dashboard. Playlist creation, transfer previews, imports, and language scans are simulated.

You can also run the demo with Docker without creating `backend/.env`:

```powershell
docker compose -f docker-compose.demo.yml up --build
```

To return to real Spotify mode, set `VITE_DEMO_MODE=false` and run the backend with valid Spotify credentials.

## Run With Docker Compose

After creating `backend/.env`, you can run both services with Docker Compose:

```powershell
docker compose up --build
```

Open:

- Frontend: `http://127.0.0.1:5173`
- Backend: `http://127.0.0.1:8000`
- Swagger: `http://127.0.0.1:8000/docs`

The frontend container uses `VITE_API_BASE_URL=http://127.0.0.1:8000` because your browser is outside Docker and reaches the backend through the mapped local port.

Backend session and export data are stored in Docker volumes:

- `backend_sessions`
- `backend_exports`

## Install

Backend:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r backend/requirements.txt
```

Frontend:

```powershell
cd frontend
npm install
```

## Run Locally

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

- Frontend: `http://127.0.0.1:5173`
- Backend: `http://127.0.0.1:8000`
- Swagger: `http://127.0.0.1:8000/docs`

## Development Commands

Backend tests:

```powershell
python -m unittest discover -s backend/tests -p "test_*.py" -v
```

Backend syntax check:

```powershell
python -m compileall backend/app
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

## CI

GitHub Actions runs:

- backend unit tests
- backend compile check
- frontend smoke test
- frontend production build

Workflow: [ci.yml](.github/workflows/ci.yml)

## Privacy And Data Handling

- Spotify OAuth tokens are stored in local browser-session files under `backend/.sessions/`.
- Snapshot files can be downloaded and uploaded through the browser; local export files may also appear under `backend/exports/`.
- The app does not need a hosted database for the local/self-hosted workflow.
- Read the full privacy note in [docs/PRIVACY.md](docs/PRIVACY.md).

## Deployment

Deployment notes are available in [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md). If you deploy this publicly, review Spotify's current developer requirements first and avoid presenting the app as a commercial service unless you have the necessary approvals.

## License

This project is released under the [MIT License](LICENSE).
