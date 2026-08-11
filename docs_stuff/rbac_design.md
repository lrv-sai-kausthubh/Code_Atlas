# CodeAtlas RBAC — Design (Phases 1–3)

Enterprise access control for CodeAtlas. The graph (what is connected to what)
and the authorization system (who may see what) are separate concerns and are
combined at request time.

```
CODE GRAPH + AUTHORIZATION GRAPH + USER CONTEXT = AUTHORIZED ARCHITECTURE VIEW
```

## Core principle

**The frontend is never a security boundary.** Every sensitive operation is
authorized server-side. The frontend only hides UI for usability. A malicious
user calling the API directly, editing JS, or modifying request parameters must
receive exactly the same limited data as the UI.

## Collaboration model

RBAC only applies to **collaborative** repositories.

- A freshly uploaded repository is **private to its owner**: the owner has full
  access and no policy is enforced against them.
- A repository becomes collaborative the moment the owner shares it — either by
  handing out a project link (`/workspace?project=<id>`) or by granting a user
  a policy.
- Collaborators who open a shared repo see the policy's `default_access`
  (metadata + graph visible, source locked) unless the owner grants them more.

### GitHub-imported repositories (GitHub collaborators as source of truth)

When a repo is imported through GitHub OAuth, the collaborator list is pulled
from the GitHub API (`GET /repos/{owner}/{repo}/collaborators`) and written into
the policy as grants:

| GitHub permission | CodeAtlas effect |
| --- | --- |
| `admin` | added to `managers`; grant `allow` metadata+graph+source+download |
| `maintain` / `push` | grant `allow` metadata+graph+source+download |
| `pull` / `read` | no grant (collaborator falls back to `default_access`) |

- Collaborators are matched to CodeAtlas users by `github_login`. A collaborator
  without an account gets the default view once they log in with the same GitHub
  account.
- `POST /api/projects/{id}/sync-collaborators` re-fetches the GitHub list so
  membership/permission changes are reflected (and audited).
- Manual grants still work for fine-tuning and for ZIP-uploaded repositories.

## Permission dimensions

Each resource (repository, folder, file) resolves to a set of boolean flags:

| Flag | Meaning |
| --- | --- |
| `metadata` | The user may know the entity exists (name, path, type, language, size). |
| `graph` | The user may see relationships (imports/dependents) in the architecture graph. |
| `source` | The user may read the actual file content / snippets / function bodies. |
| `download` | The user may download/export the raw content. |

Future flags (later phases): `search`, `ai_context`, `git.history`, `export`.

## Roles (user-level)

Stored on the user record in `users.json` as `role`:

- `super_admin` — can manage anything, including all repos and content.
- `owner` — created the repository; full access to it; manages its policy.
- `admin` — repository admin; manages policy for granted repos.
- `architect` — graph + metadata + permitted source.
- `developer` — graph + metadata + permitted source.
- `viewer` — graph + metadata only (default for new accounts).

Admin capability and content capability are independent: being an `admin` does
NOT grant `source` unless the policy grants it.

## Policy model

Persisted in `data_base/policies.json`, keyed by `project_id`:

```json
{
  "<project_id>": {
    "project_id": "...",
    "project": "...",
    "owner_email": "alice@example.com",
    "default_access": { "metadata": true, "graph": true, "source": false, "download": false },
    "grants": [
      {
        "subject_type": "user",
        "subject_value": "bob@example.com",
        "path": "backend/",
        "effect": "allow",
        "permissions": { "metadata": true, "graph": true, "source": true, "download": false }
      }
    ]
  }
}
```

- `path` is a repo-relative prefix. `""` matches the whole repository.
- Grants can be added per user (Phase 2 adds teams/roles as subject types).
- Inheritance: a grant on `backend/` applies to `backend/services/…`.
- Precedence: the **most specific path match wins**; among equally specific
  matches, `effect: "deny"` overrides `"allow"`.
- Explainability: every effective permission can be reconstructed from the
  ordered grant matches (permission explanation, §19).

## Effective access resolution

```
effective_access(user, project, resource_path) -> {metadata, graph, source, download}
  1. owner / super_admin  -> all true
  2. collect grants where subject == user AND path is a prefix of resource_path
  3. sort by path length DESC (most specific first)
  4. for each flag: first matching grant decides; effect deny => false
  5. fall back to default_access
```

## Server-side enforcement

- Analyzed graph results are persisted to `data_base/projects/<id>.json`.
- `GET /api/projects/{id}/graph` requires a session token. It returns nodes
  annotated with an `access` object and strips `file_details` (function bodies,
  snippets, signatures) for any node whose `source` flag is false.
- `GET /api/projects/{id}/file-content?path=` returns raw source **only** when
  `source` is allowed, otherwise 403.
- `GET /api/projects/{id}/file?path=` (image previews) also requires `source`.
- A user with no `metadata` access receives 404 (existence is hidden).
- Preview images are fetched as authenticated blobs (never a token in the URL).

## API surface (Phase 1)

- `GET  /api/projects/{id}/graph` — authorized graph.
- `GET  /api/projects/{id}/file-content?path=` — authorized raw source.
- `GET  /api/projects/{id}/file?path=` — authorized preview blob.
- `GET  /api/projects/{id}/policy` — policy for owner/admin.
- `POST /api/projects/{id}/grants` — add grant (owner/admin).
- `DELETE /api/projects/{id}/grants` — remove grant (owner/admin).
- `GET  /api/projects/{id}/users` — list users (owner/admin).
- `POST /api/projects/{id}/access-requests` — request access (any user).
- `GET  /api/projects/{id}/access-requests` — list requests (owner/admin).
- `POST /api/projects/{id}/access-requests/{request_id}` — approve/reject (owner/admin).
- `GET  /api/developer/projects` — projects visible to the current user.
- `GET  /api/auth/me` — now also returns the user's `role`.

## API surface (Phase 2 — teams)

- `GET  /api/teams` — list teams (super_admin).
- `POST /api/teams` — create a team (super_admin).
- `PUT  /api/teams/{id}` — rename / replace membership (super_admin).
- `POST /api/teams/{id}/members` — add members (super_admin).
- `DELETE /api/teams/{id}` — delete a team (super_admin).
- Grants now accept `subject_type: "team" | "user"`; a user inherits every
  grant applied to the teams they belong to.
- `PUT /api/projects/{id}/policy/default` — configure repository-wide default
  access flags.

## API surface (Phase 3 — temp access, versioning, search, exports)

- `GET  /api/projects/{id}/search?q=&scope=metadata|source` — permission-scoped
  search. `metadata` only returns nodes the user may know exist; `source` only
  searches inside files the user can read (no restricted bytes leave the server).
- `GET  /api/projects/{id}/export?format=json|report` — permission-aware export.
  `json` mirrors the authorized graph; `report` is a metadata-only architecture
  report that never contains source.
- Grants support `expires_at` (epoch seconds). An expired grant is ignored, so
  temporary approvals auto-revoke. Access requests can be approved temporarily
  (`action=temporary&duration_hours=…`).
- `GET  /api/projects/{id}/policy/versions` — policy history.
- `GET  /api/projects/{id}/policy/versions/{version}` — historical snapshot.
- `POST /api/projects/{id}/policy/versions/{version}/restore` — restore a snapshot.

## Graph UI behavior

- Accessible node: normal appearance.
- Metadata-only node: muted/dimmed, lock icon, "Restricted" label; edges remain
  visible.
- Clicking a restricted node shows the Restricted Inspector (metadata +
  relationships only, "Request Access" button) — never source.
- Hidden node (no metadata): not returned by the API at all.

## Audit log

Security-sensitive events are appended to `data_base/audit.jsonl`
(logins, failed logins, grants, denials, denied file access, access requests,
approvals/rejections, policy restores, exports, searches). Raw source code and
secrets are never logged.

## Threat model covered (Phases 1–3)

- Direct API calls, param tampering, guessing IDs, editing JS/React state.
- Path traversal on every content endpoint (resolve inside the upload sandbox).
- Existence leakage (404 for no-metadata users).
- Source leakage via `file_details` / snippets in graph payloads.
- Preview (image) content leakage.
- Search leakage: restricted files never surface in metadata search, and their
  bytes never surface in source search.
- Export leakage: exports never embed restricted source.
- Temp-access expiry: expired grants are ignored by the engine.
- Cross-team inheritance and explicit-deny override.

## Tests

`back_end/tests/test_authorization_engine.py` (26 stdlib unittest cases) covers
resolution, path inheritance, deny precedence, team grants, temporary access,
policy versioning, search gating and export stripping.
`back_end/tests/test_authorization_api.py` (pytest/TestClient) verifies that
unauthorized data is ABSENT from API responses: authorized user, unauthorized
user, metadata-only user, cross-repository access, path traversal, direct API
access, preview leakage, owner/admin bypass of grants management, search and
export endpoints, temporary approval expiry, policy restore, and team grants.

## Status

- Phase 1 (users, roles, repo/file perms, metadata vs source, restricted
  graph/inspector): **implemented**.
- Phase 2 (teams, inheritance, explicit deny, explanation, access requests,
  audit logs): **implemented**.
- Phase 3 (temporary permissions, policy versioning, git-aware perms, exports,
  search authorization): **implemented** (git-aware branch/commit permissions
  deferred until Git history integration).
- Phase 4 (AI authorization, secret protection): **implemented**. The Aura AI
  service (deterministic brain + scikit-learn fallback + LLM client in
  `app/services/aura/` and `app/services/ml/`) provides AI authorization,
  context filtering and audit; sensitive-information protection ships
  (redacted findings endpoint + persistence of upload-time scans).
- Phase 5 (anomaly detection, admin analytics, audit viewer): **partially
  implemented**. Enumeration / path-sweep / brute-force detection on the audit
  trail (`GET /api/admin/security-events`), an analytics dashboard
  (`GET /api/admin/analytics`) and a protected audit viewer
  (`GET /api/admin/audit`) are live for super admins, along with
  admin effective-permissions preview and impersonation preview. SSO/SCIM/OIDC
  and multi-organization tenancy are **not started**.
- Persistence: **implemented**. All state flows through `app/services/store.py`
  — a facade with a JSON-file backend (default, `data_base/`) and a PostgreSQL
  backend (set `DATABASE_URL`; Supabase/Render/Neon compatible). One-time
  migration of an existing `data_base/` into Postgres:
  `python -m scripts.migrate_to_db` (run from `back_end/`).
