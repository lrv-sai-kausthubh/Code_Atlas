import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  createOrganization,
  deleteOrganization,
  deleteProject,
  getAdminAnalytics,
  getAdminAudit,
  getAdminProjectGraph,
  getAdminSecurityEvents,
  getAdminUsers,
  getEffectivePermissions,
  getPreviewGraph,
  getProjectSecrets,
  listAdminProjects,
  listOrganizations,
  assignOrganizationProject,
  unassignOrganizationProject,
  updateOrganization,
  type AdminProject,
  type AdminUser,
} from "../../services/api";
import type {
  AdminAnalytics,
  AuditEvent,
  SecurityEvent,
  SecretFinding,
  Organization,
  EffectivePermissions,
} from "../../types/project";
import { toastError } from "../../services/toast";
import { useLiveEvents } from "../../hooks/useLiveEvents";
import { useNavigation } from "../../services/navigation";
import SecurityShell from "./security-shell";

const CARD =
  "border border-[#2a3330] bg-[#171a1a] light:border-[#d3ddd6] light:bg-[#f6f8f5]";

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="mb-2 font-dm text-[10px] tracking-[.1em] text-[#6d7974] light:text-[#61716a]">
      {children}
    </div>
  );
}

const inputClass =
  "min-w-0 border border-[#39413e] bg-[#111313] px-3 py-2 font-dm text-[11px] text-[#b9c1bd] outline-none placeholder:text-[#79817e] focus:border-[#64d5c4] light:border-[#ccd8d1] light:bg-[#edf2ee] light:text-[#34473f]";
const selectClass =
  "border border-[#39413e] bg-[#111313] px-2 py-2 font-dm text-[10px] text-[#b9c1bd] outline-none light:border-[#ccd8d1] light:bg-[#edf2ee] light:text-[#34473f]";

function AdminCenter({ token, onBack }: { token: string; onBack: () => void }) {
  const { navigate } = useNavigation();
  const [tab, setTab] = useState("overview");
  const [analytics, setAnalytics] = useState<AdminAnalytics | null>(null);
  const [audit, setAudit] = useState<AuditEvent[]>([]);
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [secrets, setSecrets] = useState<SecretFinding[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [projects, setProjects] = useState<AdminProject[]>([]);
  const [actionFilter, setActionFilter] = useState("");
  const [busy, setBusy] = useState(false);

  const [orgName, setOrgName] = useState("");
  const [draftMembers, setDraftMembers] = useState<string[]>([]);
  const [memberAdd, setMemberAdd] = useState("");
  const [orgError, setOrgError] = useState("");

  const [previewEmail, setPreviewEmail] = useState("");
  const [previewProjectId, setPreviewProjectId] = useState("");
  const [preview, setPreview] = useState<EffectivePermissions | null>(null);
  const [previewGraphStats, setPreviewGraphStats] = useState<{
    total: number;
    visible: number;
  } | null>(null);

  const refresh = useCallback(async () => {
    setBusy(true);
    const [analyticsRes, auditRes, eventsRes, secretsRes, orgsRes, usersRes, projectsRes] =
      await Promise.all([
        getAdminAnalytics(token).catch(() => null),
        getAdminAudit(token, 100, actionFilter || undefined).catch(() => null),
        getAdminSecurityEvents(token).catch(() => null),
        previewProjectId
          ? getProjectSecrets(previewProjectId, token).catch(() => null)
          : Promise.resolve(null),
        listOrganizations(token).catch(() => null),
        getAdminUsers(token).catch(() => null),
        listAdminProjects(token).catch(() => null),
      ]);
    if (analyticsRes) setAnalytics(analyticsRes.data);
    if (auditRes) setAudit(auditRes.data.events);
    if (eventsRes) setEvents(eventsRes.data.events);
    if (secretsRes) setSecrets(secretsRes.data.secrets);
    if (orgsRes) setOrganizations(orgsRes.data.organizations);
    if (usersRes) setUsers(usersRes.data.users);
    if (projectsRes) setProjects(projectsRes.data.projects);
    if (!analyticsRes && !auditRes && !eventsRes && !secretsRes && !orgsRes && !usersRes && !projectsRes) {
      toastError("Could not load admin data.");
    }
    setBusy(false);
  }, [token, actionFilter, previewProjectId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const liveRefreshRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useLiveEvents((event) => {
    const relevant =
      event.type === "user.changed" ||
      event.type === "team.changed" ||
      event.type === "org.changed" ||
      event.type === "project.created";
    if (!relevant) return;
    if (liveRefreshRef.current) return;
    liveRefreshRef.current = setTimeout(() => {
      liveRefreshRef.current = null;
      void refresh();
    }, 300);
  });

  const actions = [...new Set(audit.map((event) => event.action))];

  const handleCreateOrganization = async () => {
    setOrgError("");
    if (!orgName.trim()) {
      setOrgError("Organization name is required.");
      return;
    }
    if (draftMembers.length === 0) {
      setOrgError("Add at least one member from the registered users below.");
      return;
    }
    try {
      await createOrganization(token, orgName.trim(), draftMembers);
      setOrgName("");
      setDraftMembers([]);
      await refresh();
    } catch {
      setOrgError("Could not create organization.");
    }
  };

  const addDraftMember = () => {
    if (memberAdd && !draftMembers.includes(memberAdd)) {
      setDraftMembers([...draftMembers, memberAdd]);
    }
    setMemberAdd("");
  };

  const removeDraftMember = (email: string) => {
    setDraftMembers(draftMembers.filter((member) => member !== email));
  };

  const addOrgMember = async (org: Organization) => {
    if (!memberAdd) return;
    try {
      await updateOrganization(token, org.id, org.name, [...org.members, memberAdd]);
      setMemberAdd("");
      await refresh();
    } catch {
      toastError("Could not add member.");
    }
  };

  const removeOrgMember = async (org: Organization, email: string) => {
    try {
      await updateOrganization(
        token,
        org.id,
        org.name,
        org.members.filter((member) => member !== email),
      );
      await refresh();
    } catch {
      toastError("Could not remove member.");
    }
  };

  const handleDeleteOrganization = async (org: Organization) => {
    if (!window.confirm(`Delete organization "${org.name}"? Repos stay, but isolation is removed.`))
      return;
    try {
      await deleteOrganization(token, org.id);
      await refresh();
    } catch {
      toastError("Could not delete organization.");
    }
  };

  const handleToggleProject = async (org: Organization, project: string) => {
    try {
      if (org.project_ids.includes(project)) {
        await unassignOrganizationProject(token, org.id, project);
      } else {
        await assignOrganizationProject(token, org.id, project);
      }
      await refresh();
    } catch {
      toastError("Could not update project assignment.");
    }
  };

  const handlePreview = async () => {
    if (!previewEmail.trim() || !previewProjectId) return;
    try {
      const [perms, graph] = await Promise.all([
        getEffectivePermissions(token, previewEmail.trim(), previewProjectId),
        getPreviewGraph(token, previewEmail.trim(), previewProjectId),
      ]);
      setPreview(perms.data);
      setPreviewGraphStats({
        total: graph.data.nodes.length,
        visible: graph.data.nodes.filter((node) => node.access?.metadata).length,
      });
    } catch {
      setPreview(null);
      setPreviewGraphStats(null);
      toastError("Could not preview permissions.");
    }
  };

  const handleOpenProject = async (project: AdminProject) => {
    try {
      const response = await getAdminProjectGraph(project.project_id, token);
      navigate("home", { state: { graph: response.data } });
    } catch {
      toastError("Could not open project map.");
    }
  };

  const handleDeleteProject = async (project: AdminProject) => {
    if (!window.confirm(`Permanently delete "${project.project}" owned by ${project.owner_email}?`))
      return;
    try {
      await deleteProject(project.project_id, token);
      await refresh();
    } catch {
      toastError("Could not delete project.");
    }
  };

  const allProjects =
    analytics?.coverage.map((repo) => ({
      project_id: repo.project_id,
      project: repo.project,
    })) ?? [];

  const tabs = [
    { id: "overview", label: "OVERVIEW" },
    { id: "projects", label: "PROJECTS", badge: projects.length },
    { id: "organizations", label: "ORGANIZATIONS" },
    { id: "secrets", label: "SECRETS", badge: secrets.length },
    { id: "preview", label: "PERMISSION PREVIEW" },
    { id: "events", label: "SECURITY EVENTS", badge: events.length },
    { id: "audit", label: "AUDIT TRAIL" },
  ];

  return (
    <SecurityShell
      title="ADMIN CENTER"
      subtitle="Platform-wide security & tenancy"
      tabs={tabs}
      active={tab}
      onSelect={setTab}
      onBack={onBack}
    >
      <div className="mx-auto w-full max-w-[960px] px-6 py-6">
        {busy && (
          <div className="mb-3 font-dm text-[10px] text-[#f2b84b]">REFRESHING…</div>
        )}

        {tab === "overview" && analytics && (
          <div className="flex flex-col gap-6">
            <div>
              <SectionLabel>PLATFORM OVERVIEW</SectionLabel>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                {[
                  ["USERS", analytics.users],
                  ["TEAMS", analytics.teams],
                  ["REPOS", analytics.repositories],
                  ["GRANTS", analytics.grants_total],
                  ["PENDING REQUESTS", analytics.pending_access_requests],
                ].map(([label, value]) => (
                  <div key={label} className={`${CARD} px-4 py-3`}>
                    <div className="font-dm text-[20px] text-[#64d5c4]">{String(value)}</div>
                    <div className="mt-1 font-dm text-[9px] tracking-[.08em] text-[#6d7974] light:text-[#61716a]">
                      {label}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {analytics.coverage.length > 0 && (
              <div>
                <SectionLabel>PERMISSION COVERAGE</SectionLabel>
                <div className="flex flex-col gap-1.5">
                  {analytics.coverage.map((repo) => (
                    <div key={repo.project_id} className={`${CARD} flex items-center justify-between gap-2 px-3 py-2`}>
                      <div className="min-w-0 truncate font-dm text-[11px] text-[#b9c1bd] light:text-[#34473f]">
                        {repo.project}
                      </div>
                      <div className="shrink-0 font-dm text-[10px] text-[#79817e] light:text-[#61716a]">
                        {repo.grants} GRANTS · SOURCE DEFAULT {repo.source_default ? "ON" : "OFF"}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {tab === "projects" && (
          <div className="flex flex-col gap-6">
            <div>
              <SectionLabel>ALL PROJECTS · PLATFORM-WIDE MANAGEMENT</SectionLabel>
              {projects.length === 0 ? (
                <div className={`${CARD} px-4 py-6 text-center font-dm text-[11px] text-[#79817e]`}>
                  No projects yet.
                </div>
              ) : (
                <div className="flex flex-col">
                  {projects.map((project) => (
                    <div
                      key={project.project_id}
                      className="flex items-center gap-2 border-b border-[#242a28] px-2 py-2 last:border-b-0 light:border-[#d6dfda]"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-dm text-[11px] text-[#b9c1bd] light:text-[#34473f]">
                          {project.project}
                        </div>
                        <div className="truncate font-dm text-[9px] text-[#79817e] light:text-[#61716a]">
                          {project.owner_email} · {project.source.toUpperCase()} · STATUS {project.status.toUpperCase()}
                          {project.organization_id ? ` · ORG ${project.organization_id.slice(0, 8)}` : ""}
                        </div>
                      </div>
                      <button
                        onClick={() => void handleOpenProject(project)}
                        className="shrink-0 border border-[#2a6b61] px-2 py-1 font-dm text-[9px] tracking-[.08em] text-[#64d5c4] hover:bg-[#1d2f2c]"
                      >
                        OPEN MAP
                      </button>
                      <button
                        onClick={() => void handleDeleteProject(project)}
                        className="shrink-0 border border-[#6b2f2a] px-2 py-1 font-dm text-[9px] tracking-[.08em] text-[#e58a80] hover:bg-[#3a1d1a]"
                      >
                        DELETE
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {tab === "organizations" && (
          <div className="flex flex-col gap-6">
            <div>
              <SectionLabel>CREATE ORGANIZATION · MULTI-TENANT ISOLATION</SectionLabel>
              <div className={`${CARD} flex flex-col gap-2 p-3`}>
                <div className="flex items-center gap-2">
                  <input
                    className={inputClass}
                    placeholder="Organization name"
                    value={orgName}
                    onChange={(event) => setOrgName(event.target.value)}
                  />
                  <button
                    className="shrink-0 border border-[#64d5c4]/60 px-4 py-2 font-dm text-[10px] tracking-[.08em] text-[#64d5c4] hover:bg-[#64d5c4]/10"
                    onClick={() => void handleCreateOrganization()}
                  >
                    CREATE ORG
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    className={`${selectClass} min-w-0 flex-1`}
                    value={memberAdd}
                    onChange={(event) => setMemberAdd(event.target.value)}
                  >
                    <option value="">NEW ORG MEMBERS — PICK REGISTERED USERS</option>
                    {users.map((user) => (
                      <option key={user.email} value={user.email}>
                        {user.email} · {user.role}{" "}
                        {user.github_login ? `· @${user.github_login}` : ""}
                      </option>
                    ))}
                  </select>
                  <button
                    className="shrink-0 border border-[#39413e] px-3 py-2 font-dm text-[10px] text-[#79817e] hover:border-[#64d5c4] hover:text-[#64d5c4]"
                    onClick={addDraftMember}
                  >
                    ADD
                  </button>
                </div>
                {draftMembers.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {draftMembers.map((email) => (
                      <span
                        key={email}
                        className="flex items-center gap-1 border border-[#64d5c4]/50 px-1.5 py-0.5 font-dm text-[9px] text-[#64d5c4]"
                      >
                        {email}
                        <button className="text-[#f17c71]" onClick={() => removeDraftMember(email)}>
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                {orgError && <div className="font-dm text-[10px] text-[#f17c71]">{orgError}</div>}
              </div>
            </div>
            <div>
              <SectionLabel>ORGANIZATIONS ({organizations.length})</SectionLabel>
              {organizations.length === 0 && (
                <div className={`${CARD} px-4 py-6 text-center font-dm text-[11px] text-[#79817e]`}>
                  No organizations yet. Create one to lock repos down to a tenant.
                </div>
              )}
              <div className="flex flex-col gap-2">
                {organizations.map((org) => (
                  <div key={org.id} className={`${CARD} p-3`}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1 truncate font-dm text-[12px] text-[#b9c1bd] light:text-[#34473f]">
                        {org.name} · <span className="text-[#79817e]">{org.owner_email}</span>
                      </div>
                      <button
                        className="shrink-0 border border-[#39413e] px-2 py-1 font-dm text-[9px] text-[#f17c71] hover:border-[#f17c71]"
                        onClick={() => void handleDeleteOrganization(org)}
                      >
                        DELETE
                      </button>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {org.members.map((member) => {
                        const account = users.find((user) => user.email === member);
                        return (
                          <span
                            key={member}
                            className="flex items-center gap-1 border border-[#2a3330] px-1.5 py-0.5 font-dm text-[9px] text-[#b9c1bd] light:border-[#ccd8d1] light:text-[#34473f]"
                          >
                            {member}
                            {account ? (
                              <span className="text-[#64d5c4]">{account.role.toUpperCase()} ✓</span>
                            ) : (
                              <span className="text-[#f17c71]">NO ACCOUNT ✗</span>
                            )}
                            <button className="text-[#f17c71]" onClick={() => void removeOrgMember(org, member)}>
                              ×
                            </button>
                          </span>
                        );
                      })}
                      <span className="flex items-center gap-1">
                        <select
                          className={`${selectClass} px-1 py-0.5`}
                          value={memberAdd}
                          onChange={(event) => setMemberAdd(event.target.value)}
                        >
                          <option value="">ADD MEMBER …</option>
                          {users
                            .filter((user) => !org.members.includes(user.email))
                            .map((user) => (
                              <option key={user.email} value={user.email}>
                                {user.email} · {user.role}
                              </option>
                            ))}
                        </select>
                        <button
                          className="border border-[#39413e] px-1.5 py-0.5 font-dm text-[9px] text-[#79817e] hover:text-[#64d5c4]"
                          onClick={() => void addOrgMember(org)}
                        >
                          ADD
                        </button>
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {allProjects.map((repo) => {
                        const attached = org.project_ids.includes(repo.project_id);
                        return (
                          <button
                            key={repo.project_id}
                            className={`border px-2 py-0.5 font-dm text-[9px] ${
                              attached
                                ? "border-[#64d5c4]/70 text-[#64d5c4]"
                                : "border-[#39413e] text-[#79817e] hover:border-[#64d5c4]/50"
                            }`}
                            onClick={() => void handleToggleProject(org, repo.project_id)}
                            title={attached ? "Click to detach repo from org" : "Click to attach repo to org"}
                          >
                            {repo.project} {attached ? "·ORG" : ""}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === "secrets" && (
          <div>
            <SectionLabel>SECRET FINDINGS · {secrets.length} (REDACTED)</SectionLabel>
            {secrets.length === 0 ? (
              <div className={`${CARD} px-4 py-6 text-center font-dm text-[11px] text-[#79817e]`}>
                No secrets detected. Select a project from the secret scanner config to rescan.
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                {secrets.slice(0, 40).map((finding, index) => (
                  <div key={index} className={`${CARD} border-[#f17c71]/40 px-3 py-2`}>
                    <div className="truncate font-dm text-[11px] text-[#f2b84b]">
                      {finding.label} · {finding.file}
                      {finding.line ? `:${finding.line}` : ""}
                    </div>
                    <div className="truncate font-mono text-[10px] text-[#89958f]">
                      {finding.preview}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "preview" && (
          <div className="flex flex-col gap-6">
            <div>
              <SectionLabel>PREVIEW AS · READ-ONLY PERMISSION SIMULATION</SectionLabel>
              <p className="mb-3 max-w-[680px] text-[12px] leading-[1.6] text-[#89958f] light:text-[#61716a]">
                See exactly what another user is allowed to know, without impersonating
                them. Read-only — every preview is recorded in the audit trail.
              </p>
              <div className={`${CARD} flex flex-col gap-2 p-3`}>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    className={`${inputClass} flex-1`}
                    placeholder="Target user email"
                    value={previewEmail}
                    onChange={(event) => setPreviewEmail(event.target.value)}
                  />
                  <select
                    className={`${selectClass} min-w-0 flex-1`}
                    value={previewProjectId}
                    onChange={(event) => setPreviewProjectId(event.target.value)}
                  >
                    <option value="">SELECT PROJECT</option>
                    {allProjects.map((repo) => (
                      <option key={repo.project_id} value={repo.project_id}>
                        {repo.project}
                      </option>
                    ))}
                  </select>
                  <button
                    className="shrink-0 border border-[#64d5c4]/60 px-4 py-2 font-dm text-[10px] tracking-[.08em] text-[#64d5c4] hover:bg-[#64d5c4]/10"
                    onClick={() => void handlePreview()}
                  >
                    PREVIEW
                  </button>
                </div>
                {preview && (
                  <div className="border-t border-[#2a3330] pt-3 light:border-[#d3ddd6]">
                    <div className="font-dm text-[11px] text-[#b9c1bd] light:text-[#34473f]">
                      {preview.email} · ROLE {preview.role.toUpperCase()}
                      {preview.owner ? " · OWNER" : ""}
                      {preview.organization ? ` · ORG ${preview.organization}` : " · NO ORG"}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {(["metadata", "graph", "source", "download"] as const).map((flag) => (
                        <span
                          key={flag}
                          className={`border px-2 py-0.5 font-dm text-[9px] ${
                            preview.effective_access[flag]
                              ? "border-[#64d5c4]/70 text-[#64d5c4]"
                              : "border-[#39413e] text-[#79817e] light:border-[#c2cfc7]"
                          }`}
                        >
                          {flag.toUpperCase()} {preview.effective_access[flag] ? "ON" : "OFF"}
                        </span>
                      ))}
                    </div>
                    {previewGraphStats && (
                      <div className="mt-2 font-dm text-[10px] text-[#79817e] light:text-[#61716a]">
                        GRAPH: {previewGraphStats.visible} OF {previewGraphStats.total} NODES
                        VISIBLE · {previewGraphStats.total - previewGraphStats.visible} HIDDEN
                        (NO EXISTENCE LEAK)
                      </div>
                    )}
                    {preview.explanation.steps.length > 0 && (
                      <div className="mt-2 flex flex-col gap-0.5">
                        {preview.explanation.steps.map((step, index) => (
                          <div key={index} className="truncate font-dm text-[10px] text-[#89958f]">
                            • {step.permission.toUpperCase()} @ {step.path || "/"} →{" "}
                            {step.value ? "ALLOW" : "DENY"}
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="mt-2 truncate font-dm text-[10px] text-[#79817e] light:text-[#61716a]">
                      {preview.grants.length} GRANTS · TEAMS: {preview.teams.join(", ") || "NONE"}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {tab === "events" && (
          <div>
            <SectionLabel>SECURITY EVENTS / ANOMALY ALERTS</SectionLabel>
            {events.length === 0 ? (
              <div className={`${CARD} px-4 py-6 text-center font-dm text-[11px] text-[#79817e]`}>
                No suspicious behavior detected.
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                {events.slice(0, 40).map((event) => (
                  <div key={event.id} className={`${CARD} px-3 py-2`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-dm text-[11px] text-[#f17c71]">
                        {event.kind.toUpperCase()} · {event.severity.toUpperCase()}
                      </span>
                      <span className="shrink-0 font-dm text-[9px] text-[#79817e] light:text-[#61716a]">
                        {new Date(event.ts * 1000).toLocaleString()}
                      </span>
                    </div>
                    <div className="mt-0.5 truncate font-dm text-[10px] text-[#89958f]">
                      {event.email || "system"} · {JSON.stringify(event.detail)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "audit" && (
          <div>
            <div className="mb-3 flex items-center gap-3">
              <SectionLabel>AUDIT TRAIL</SectionLabel>
              <select
                className={`${selectClass} px-1 py-0.5`}
                value={actionFilter}
                onChange={(event) => setActionFilter(event.target.value)}
              >
                <option value="">ALL ACTIONS</option>
                {actions.map((action) => (
                  <option key={action} value={action}>
                    {action.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>
            {audit.length === 0 ? (
              <div className={`${CARD} px-4 py-6 text-center font-dm text-[11px] text-[#79817e]`}>
                No audit events.
              </div>
            ) : (
              <div className="flex flex-col">
                {audit.map((event, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-2 border-b border-[#242a28] px-2 py-2 last:border-b-0 light:border-[#d6dfda]"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-dm text-[11px] text-[#b9c1bd] light:text-[#34473f]">
                        {event.email} · <span className="text-[#64d5c4]">{event.action}</span> ·{" "}
                        {event.resource}
                      </div>
                    </div>
                    <div className="shrink-0 font-dm text-[9px] text-[#79817e] light:text-[#61716a]">
                      {event.ts ? new Date(event.ts * 1000).toLocaleString() : ""}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </SecurityShell>
  );
}

export default AdminCenter;
