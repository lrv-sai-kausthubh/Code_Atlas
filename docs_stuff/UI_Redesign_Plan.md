# CodeAtlas UI Redesign Plan

> **Status:** Phase A–D implemented (see §10). Remaining: visual folder-tree policy editor (§4.4) is a simplified path-rule editor for now; can be upgraded later.

## 1. The Intended Product Flow (what the app is supposed to do)

This is the flow the product is built for. Every UI decision below exists to make this flow obvious:

```
1. GitHub repo owner signs up on CodeAtlas
        ↓
2. Owner connects GitHub account (OAuth)
        ↓
3. Owner imports a repository from GitHub
        ↓
4. CodeAtlas parses the repo → builds the architecture graph
        ↓
5. Owner opens the project's SECURITY CENTER
        ↓
6. Owner clicks "Sync GitHub Collaborators" →
   GitHub members of that repo are imported as users
        ↓
7. Owner assigns access levels to those collaborators:
   • Can see graph + metadata only (default)
   • Can also see source code
   • Can download / export
        ↓
8. Owner sends them the share link
        ↓
9. Collaborator opens the link → sees the architecture graph
   with LOCKED nodes for files they can't read
        ↓
10. Collaborator clicks a locked file → "Request Access" →
    owner gets the request in Security Center → approves /
    rejects / approves for 24h
```

**Key principle:** the repo owner is the security manager of their project. The UI must make steps 5 → 10 feel like one guided journey, not a buried technical feature.

---

## 2. Diagnosis: Why the Current UI Feels Broken

| # | Problem | Where | Impact |
|---|---------|-------|--------|
| 1 | Access control is squeezed into a 245px inspector sidebar | `access-control.tsx` | All 8 features (default access, exports, requests, users, teams, schedules, versions, sync) stacked in one endless vertical scroll. Impossible to navigate. |
| 2 | Micro-typography: 7–10px mono text everywhere in security panels | `access-control.tsx`, `admin-security.tsx` | Unreadable; looks broken even when it works. |
| 3 | Admin panel is a fullscreen overlay mixing 6 unrelated modules | `admin-security.tsx` | Analytics + secrets + orgs + permission preview + audit + coverage in one screen, no tabs, no hierarchy. |
| 4 | Entry points are invisible & inconsistent | `graph-panel.tsx:67` (emoji 🛡 button), `inspector-panel.tsx:208` (tiny "ACCESS CONTROL" text button) | Users can't find security; the flow makes no sense without a guide. |
| 5 | No onboarding after GitHub import | `access-control.tsx:350` | The "Sync GitHub Collaborators" button sits deep inside the panel. Owner never learns the core flow. |
| 6 | No "My Projects" page | `listDeveloperProjects` exists in `api.ts:146` but is never rendered | After login you land on the upload screen. Returning users have no home. |
| 7 | Graph workspace has no consistent top nav | `workspace-layout.tsx` | Explorer / Graph / Inspector are good, but there's no way to reach settings, security, profile without leaving the project. |
| 8 | Restricted-node UX is decent but unannounced | `index.css:88` `.atlas-node-restricted` | Locked styling exists; nothing explains it until you click. First-time users think the graph is broken. |

**Verdict:** The security *backend* is strong (policies, grants, teams, versions, audit, orgs, sync). The *frontend* never got its own page — it was bolted into panels designed for graph exploration.

---

## 3. New Information Architecture (routes & pages)

```
LANDING          /              marketing page (keep, polish)
LOGIN            /login         (keep)
HOME             /workspace     project list + upload (NEW: split into two states)
   ├── Projects list            (NEW — uses listDeveloperProjects)
   └── Upload screen            (existing LandingView, moved to a tab)
WORKSPACE        /w/:projectId  graph explorer (keep layout, add top nav links)
SECURITY CENTER  /security/:projectId   (NEW — dedicated page, owner + admins)
SETTINGS         /settings      user settings (keep)
PROFILE          /profile       user profile (keep)
```

### New "Home" page (project list)
- Grid of cards: project name, source (GITHUB / ZIP), file count, health, owner, "You can read X of Y files".
- Buttons: OPEN (workspace), SECURITY (if manager), and a prominent "+ ADD PROJECT" that switches to the upload tab.
- This makes the product feel like a product instead of a single-screen demo.

---

## 4. New SECURITY CENTER (the core redesign)

A dedicated full page — never a sidebar overlay — with a left sidebar (navigation) + content area. Only reachable by repo owners/managers/admins.

### 4.1 Left sidebar (tabs)
```
SECURITY CENTER — <project name>
├── OVERVIEW            (wizard status + stats)
├── COLLABORATORS       (GitHub sync + member list + access level per member)
├── TEAMS               (create/edit teams, assign members)
├── ACCESS POLICIES     (permission matrix per path — tree editor)
├── ACCESS REQUESTS     (inbox: approve / reject / temporary)
├── AUDIT LOG           (who did what)
└── SETTINGS            (default access, exports, policy versions)
```

### 4.2 OVERVIEW tab — guided setup (fixes problem #5)
The owner sees their journey as a checklist:

```
CONNECT YOUR GITHUB COLLABORATORS
  1. ✓ Project imported from GitHub
  2. → Sync collaborators from GitHub         [button: SYNC NOW]
  3. → Choose access level per collaborator   [button: ASSIGN]
  4. → Share the project link                 [button: COPY LINK]
  5. → Review access requests                 (2 pending)
```

Until sync runs, the page gently explains the flow in one sentence:
> "Members you've added to this repo on GitHub appear here. You decide what each one can see."

### 4.3 COLLABORATORS tab — per-person access levels
Replace the single "GRANT SOURCE" toggle with a real access-level picker per user:

```
┌────────────────────────────────────────────────────────┐
│  @hemanth        hemanth@x.com   ·  OWNER   [FULL]     │
│  @sara           sara@x.com      ·  COLLAB  [▾ GRAPH]  │
│  @devops_bot     bot@x.com       ·  COLLAB  [▾ SOURCE] │
└────────────────────────────────────────────────────────┘
```

Access levels (a single picker instead of 4 checkboxes):
- **NONE** — invisible, not in the graph
- **GRAPH** — see node + metadata + relationships (locked)
- **SOURCE** — GRAPH + read source
- **FULL** — SOURCE + download/export

A small legend explains: `GRAPH = can see it exists · SOURCE = can read the code`.

### 4.4 ACCESS POLICIES tab — visual folder tree
Per-folder/file overrides with a tree editor (the `New_version_prompt.md` §40 design):

```
repository/
├── frontend/      [ALLOW ▾]
├── backend/       [ALLOW ▾]
│   ├── services/  [ALLOW ▾]
│   └── secrets/   [DENY ▾]   ← red
└── payments/      [RESTRICT ▾] ← amber, only metadata visible
```

Each node gets a dropdown: ALLOW / RESTRICT (metadata-only) / DENY (hidden). Fine-grained checkboxes (Metadata, Graph, Source, Download) open in a side drawer when a node is selected.

### 4.5 ACCESS REQUESTS tab — inbox cards
Same data as today, but card-based with a clear resolve flow:

```
@alice requests SOURCE access to services/payment_service.py
"Need to debug checkout integration."        [REJECT] [APPROVE]
                                            [TEMPORARY: ▢ 24h]
```

### 4.6 AUDIT LOG tab
Simple filterable table (actor, action, resource, time, result) with the existing action filter.

### 4.7 SETTINGS tab
- Default repository access (the 4 toggles, as readable switches)
- Export buttons (GRAPH JSON / ARCHITECTURE REPORT)
- Policy versions list (restore)

---

## 5. Super Admin Center (separate page)

Keep the two audiences apart:
- **SECURITY CENTER** (per project) → for repo owners/managers — what section 4 describes.
- **ADMIN CENTER** (platform-wide, `/admin`) → for super admins — analytics, secret findings, organizations, permission preview ("Preview as Alice"), security events, global audit.

Admin center gets the same layout pattern: left tab sidebar + content:
```
ADMIN CENTER
├── OVERVIEW       (stats + permission coverage)
├── ORGANIZATIONS  (multi-tenant isolation)
├── SECRETS        (redacted findings)
├── PERMISSION PREVIEW  ("Preview as…" simulator)
├── SECURITY EVENTS     (anomaly alerts)
└── AUDIT TRAIL
```

---

## 6. Workspace improvements (explorer/graph/inspector)

Keep the 3-pane layout (it's the product's identity) but fix the edges:

1. **Top bar in workspace** — instead of burying things: a project-level bar with breadcrumb (project name), buttons `SECURITY` (owner only), `ANALYSIS`, `SEARCH`, and back-to-projects. Security opens the dedicated page, never an overlay.
2. **Inspector** — remove the embedded ACCESS CONTROL; keep only node info + source intelligence + request access.
3. **Restricted nodes** — keep muted/lock styling but add a one-line legend in the graph toolbar ("🖥 muted = visible but locked"), and an explainer tooltip on first click: *"You can see this file in the graph, but not its source. Request access from the owner."* (already built in `inspector-panel.tsx` RestrictedPanel — keep, polish).
4. **Typography** — global minimum font size 11px for secondary text, 12–13px for body. Kill the 7–9px micro-fonts in panels.

---

## 7. Design system consistency (whole site)

- **One button language**: primary (amber border `#f2b84b`), success (teal `#64d5c4`), danger (red `#f17c71`), neutral. Reuse everywhere; remove emoji buttons in favor of icons + text labels.
- **Typography scale**: `--text-xs (12) / sm (13) / base (14) / lg (17)` — DM Mono for labels/meta only, Space Grotesk for body/headings.
- **Shared panel classes**: already exist in `panel-classes.ts` — extend to security page.
- **Toasts**: keep sonner, consistent messages.
- **Empty states**: "No collaborators yet — connect GitHub to import them", "No requests", etc. (currently blank space).
- **Light theme**: verify every new page (current panels have light variants; new pages must too).

---

## 8. Implementation Plan (phases)

### Phase A — Foundations (1–2 days)
1. Add routes: `projects` (home list), `security/:projectId`, `admin`.
2. Extract a `SecurityShell` layout component (sidebar tabs + content) used by both Security Center and Admin Center.
3. Global typography cleanup (kill sub-10px fonts).

### Phase B — Security Center (2–3 days)
4. Build OVERVIEW tab with the guided checklist + stats.
5. Build COLLABORATORS tab with access-level picker (maps to existing `addGrant`/`removeGrant` APIs).
6. Move existing teams UI into TEAMS tab (reuse logic from `access-control.tsx`).
7. Build ACCESS REQUESTS + AUDIT + SETTINGS tabs (reuse existing handlers).
8. Wire the workspace top bar: `SECURITY` button → navigate to `/security/:projectId`.

### Phase C — Admin Center (1–2 days)
9. Split `admin-security.tsx` into the 6 tabs under the shared shell.
10. Remove the fullscreen overlay + 🛡 button; entry becomes profile menu / top bar "ADMIN".

### Phase D — Home & polish (1–2 days)
11. Build project list page using `listDeveloperProjects` + upload tab.
12. Restricted-node legend + first-click explainer in graph.
13. Light theme + empty states + responsive pass.

### Phase E — Cleanup
14. Delete dead code: `AccessControlPanel` from inspector, overlay in `graph-panel.tsx`.
15. Run lint/typecheck (`npm run lint`, `tsc`) and fix.

---

## 10. Implementation Status

| Item | Status |
|------|--------|
| Routes: projects / security / admin (+ nav state passing) | ✅ `navigation.tsx`, `App.tsx` |
| Projects page (list + add-project tab) | ✅ `pages/projects.tsx` |
| Workspace-only page (graph via nav state / shared link) | ✅ `pages/workspace.tsx` |
| SecurityShell (sidebar tabs layout) | ✅ `components/security/security-shell.tsx` |
| Security Center (Overview checklist, Collaborators w/ level picker, Teams, Access Policies, Requests, Settings) | ✅ `components/security/security-center.tsx` |
| Admin Center (Overview, Organizations, Secrets, Preview, Events, Audit) | ✅ `components/security/admin-center.tsx` |
| Workspace SECURITY / ADMIN buttons; old overlay + inspector ACCESS CONTROL removed | ✅ `graph-panel.tsx`, `inspector-panel.tsx` |
| Deleted legacy `access-control.tsx`, `admin-security.tsx`, `pages/home.tsx` | ✅ |
| Restricted-node count legend in graph toolbar | ✅ `graph-panel.tsx` |
| Typography: new pages use 10–13px text (no 7–9px micro-fonts) | ✅ new components |
| Visual folder-tree permission editor (§4.4) | ⏳ path-rule list editor shipped; tree view is a future upgrade |

## 11. What NOT to do (scope guard)

- Do not change the graph rendering engine or the 3-pane workspace identity.
- Do not add new backend APIs unless a gap is found — everything needed already exists (grants, teams, requests, versions, sync, audit, orgs, preview, analytics).
- Do not touch backend security logic (it's correct); only presentation changes.
- Keep `New_version_prompt.md` §38–41 (graph access states, admin UX) as the source of truth for behavior.
