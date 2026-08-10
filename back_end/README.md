# CodeAtlas Backend

FastAPI + uvicorn backend for CodeAtlas.

## Setup

```
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

The API runs at `http://127.0.0.1:8000` and the React dev server at `http://localhost:5173` is allowlisted in CORS.

## GitHub OAuth (login + "connect your repos")

The app supports email/password accounts and GitHub OAuth. To enable GitHub
sign-in, register a GitHub OAuth App:

1. Go to https://github.com/settings/developers → New OAuth App.
2. Homepage URL: `http://localhost:5173`
3. Authorization callback URL: `http://localhost:8000/api/auth/github/callback`
4. Create the app, then copy the Client ID and Client Secret into a `.env` file in this `back_end/` folder:

```
GITHUB_CLIENT_ID=your_client_id
GITHUB_CLIENT_SECRET=your_client_secret
```

Then run the backend normally:

```
uvicorn app.main:app --port 8000
```

The backend loads `back_end/.env` automatically at startup (via `python-dotenv`, with a built-in fallback). The file is git-ignored so the credentials stay local.

Optional environment variables:

- `FRONTEND_URL` — where the OAuth flow redirects after login (default `http://localhost:5173`).
- `BACKEND_BASE` — public base URL of this API, used to build the OAuth callback (default `http://localhost:8000`).

## Auth endpoints

| Method | Path | Purpose |
| ------ | ---- | ------- |
| POST | `/api/auth/register` | Create an account (`name`, `email`, `password`) |
| POST | `/api/auth/login` | Sign in (`email`, `password`) → `{ token, user }` |
| POST | `/api/auth/logout` | Invalidate a session (`token`) |
| GET | `/api/auth/me?token=` | Current user for a session |
| GET | `/api/auth/github/authorize` | Redirect to GitHub consent screen |
| GET | `/api/auth/github/callback?code=` | OAuth callback → redirects to `FRONTEND_URL/?token=...&github=connected` |
| GET | `/api/auth/github/repos?token=` | List the connected account's repositories |
| POST | `/api/auth/github/import` | Import a connected repo (`repo_url`, `upload_id`, `token`) |

Accounts are stored in `data_base/users.json` (passwords are salted and hashed).
Sessions are held in memory and are lost on restart; users just sign in again.

## Deployment (Render)

The repo includes `back_end/Dockerfile` and a root `render.yaml` blueprint.

1. Push to GitHub, then in Render: **New + → Blueprint** → select this repo.
2. In the dashboard set the secrets: `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`,
   `FRONTEND_URL` (e.g. `https://your-app.vercel.app`), `BACKEND_BASE`
   (e.g. `https://your-api.onrender.com`), `ALLOWED_ORIGINS` if needed.
   `CODEATLAS_SECRET_KEY` is auto-generated on first deploy.
3. In your GitHub OAuth app, set the authorization callback URL to
   `https://your-api.onrender.com/api/auth/github/callback`.
4. Set `VITE_API_URL` on the Vercel project hosting the frontend.

**Important:** the backend keeps sessions and the SSE event bus in memory, so
run exactly one uvicorn process (the Dockerfile default) and no replicas until
sessions move to a shared store. Instance disk is ephemeral: `data_base/`
writes (users, sessions, projects, uploads) are lost on every deploy — the
managed-database migration (Supabase) is the next phase.

Health check: `GET /healthz`.
