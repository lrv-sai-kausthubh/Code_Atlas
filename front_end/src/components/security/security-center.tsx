import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { RefreshCw } from "lucide-react";
import {
  addGrant,
  createTeam,
  deleteTeam,
  exportProject,
  getProjectPolicy,
  listAccessRequests,
  listPolicyVersions,
  listProjectUsers,
  listTeams,
  removeGrant,
  resolveAccessRequest,
  restorePolicyVersion,
  setUserRole,
  syncCollaborators,
  updateDefaultAccess,
  updateManager,
  updateTeam,
} from "../../services/api";
import type {
  AccessRequest,
  NodeAccess,
  PolicyVersion,
  RepositoryPolicy,
  Team,
} from "../../types/project";
import {
  toastError,
  toastSuccess,
  toastProcessing,
} from "../../services/toast";
import { useLiveEvents } from "../../hooks/useLiveEvents";
import SecurityShell from "./security-shell";

type AccessLevel = "none" | "graph" | "source" | "full";

const LEVEL_OPTIONS: { id: AccessLevel; label: string; hint: string }[] = [
  { id: "none", label: "NONE", hint: "Not visible in the graph" },
  {
    id: "graph",
    label: "GRAPH",
    hint: "See node + relationships, source locked",
  },
  { id: "source", label: "SOURCE", hint: "Graph + read source code" },
  { id: "full", label: "FULL", hint: "Source + download / export" },
];

const ROLE_OPTIONS = ["viewer", "developer", "architect", "admin"];

const accessFromLevel = (level: AccessLevel): NodeAccess => ({
  metadata: true,
  graph: true,
  source: level === "source" || level === "full",
  download: level === "full",
});

const levelFromAccess = (access?: NodeAccess | null): AccessLevel =>
  access
    ? access.download
      ? "full"
      : access.source
        ? "source"
        : access.graph
          ? "graph"
          : "none"
    : "none";

const CARD =
  "border border-[#2a3330] bg-[#171a1a] light:border-[#d3ddd6] light:bg-[#f6f8f5]";

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="mb-2 font-dm text-[10px] tracking-[.1em] text-[#6d7974] light:text-[#61716a]">
      {children}
    </div>
  );
}

function LevelPicker({
  value,
  onChange,
  disabled,
}: {
  value: AccessLevel;
  onChange: (level: AccessLevel) => void;
  disabled?: boolean;
}) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value as AccessLevel)}
      className="shrink-0 border border-[#39413e] bg-[#111313] px-2 py-1.5 font-dm text-[10px] text-[#b9c1bd] outline-none disabled:opacity-50 light:border-[#ccd8d1] light:bg-[#edf2ee] light:text-[#34473f]"
    >
      {LEVEL_OPTIONS.map((level) => (
        <option key={level.id} value={level.id}>
          {level.label}
        </option>
      ))}
    </select>
  );
}

function SecurityCenter({
  projectId,
  token,
  onBack,
}: {
  projectId: string;
  token: string;
  onBack: () => void;
}) {
  const [tab, setTab] = useState("overview");
  const [policy, setPolicy] = useState<RepositoryPolicy | null>(null);
  const [users, setUsers] = useState<
    {
      email: string;
      name: string;
      role: string;
      github_login?: string | null;
    }[]
  >([]);
  const [pending, setPending] = useState<
    { login: string; permission: string }[]
  >([]);
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [versions, setVersions] = useState<PolicyVersion[]>([]);
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [tempHours, setTempHours] = useState<Record<string, string>>({});
  const [newTeam, setNewTeam] = useState({ name: "", members: "" });
  const [policyPath, setPolicyPath] = useState({
    subjectType: "user",
    subjectValue: "",
    path: "",
    effect: "allow" as "allow" | "deny",
    metadata: true,
    graph: true,
    source: true,
    download: true,
    expiresHours: "",
  });
  const [sched, setSched] = useState({
    subjectType: "user",
    subjectValue: "",
    days: [0, 1, 2, 3, 4],
    start: "09:00",
    end: "17:00",
  });
  const [managerEmail, setManagerEmail] = useState("");
  const [memberEmail, setMemberEmail] = useState("");
  const [memberLevel, setMemberLevel] = useState<AccessLevel>("graph");
  const [formError, setFormError] = useState("");

  const refresh = useCallback(async () => {
    try {
      const [policyRes, usersRes, requestsRes, teamsRes, versionsRes] =
        await Promise.all([
          getProjectPolicy(projectId, token).catch(() => null),
          listProjectUsers(projectId, token).catch(() => null),
          listAccessRequests(projectId, token).catch(() => null),
          listTeams(token, projectId).catch(() => null),
          listPolicyVersions(projectId, token).catch(() => null),
        ]);
      if (policyRes) setPolicy(policyRes.data);
      if (usersRes) setUsers(usersRes.data.users);
      if (usersRes) setPending(usersRes.data.pending ?? []);
      if (requestsRes)
        setRequests(
          requestsRes.data.requests.filter(
            (request) => request.status === "pending",
          ),
        );
      if (teamsRes) setTeams(teamsRes.data.teams);
      if (versionsRes) setVersions(versionsRes.data.versions);
      if (!policyRes || !usersRes || !requestsRes) {
        toastError("Could not load access control data.");
      }
    } catch {
      toastError("Could not load access control data.");
    }
  }, [projectId, token]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const liveRefreshRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useLiveEvents((event) => {
    const related =
      event.type === "team.changed" ||
      event.type === "user.changed" ||
      (event.project_id === projectId &&
        (event.type.startsWith("policy.") || event.type === "access.request"));
    if (!related) return;
    if (liveRefreshRef.current) return;
    liveRefreshRef.current = setTimeout(() => {
      liveRefreshRef.current = null;
      void refresh();
    }, 300);
  });

  const markBusy = (key: string) =>
    setBusy((current) => new Set(current).add(key));
  const markIdle = (key: string) =>
    setBusy((current) => {
      const next = new Set(current);
      next.delete(key);
      return next;
    });

  const grantFor = (subjectType: string, subjectValue: string) =>
    (policy?.grants ?? []).find(
      (grant) =>
        grant.subject_type === subjectType &&
        grant.subject_value === subjectValue &&
        grant.path === "" &&
        grant.effect === "allow",
    );

  const setLevel = async (
    subjectType: string,
    subjectValue: string,
    level: AccessLevel,
  ) => {
    markBusy(`${subjectType}:${subjectValue}`);
    try {
      if (level === "none") {
        await removeGrant(projectId, token, {
          subject_type: subjectType,
          subject_value: subjectValue,
          path: "",
        });
        toastSuccess(`Access removed for ${subjectValue}.`);
      } else {
        await addGrant(projectId, token, {
          subject_type: subjectType,
          subject_value: subjectValue,
          path: "",
          effect: "allow",
          permissions: accessFromLevel(level),
        });
        toastSuccess(`${subjectValue} now has ${level.toUpperCase()} access.`);
      }
      await refresh();
    } catch {
      toastError("Could not update the grant.");
    } finally {
      markIdle(`${subjectType}:${subjectValue}`);
    }
  };

  const resolve = async (
    request: AccessRequest,
    action: "approve" | "reject" | "temporary",
  ) => {
    markBusy(`req-${request.id}`);
    try {
      const hours = Number(tempHours[request.id] || 0);
      await resolveAccessRequest(
        projectId,
        token,
        request.id,
        action,
        hours > 0 ? hours : undefined,
      );
      toastSuccess(
        `Request ${action === "approve" ? "approved" : action === "temporary" ? "temporarily approved" : "rejected"}.`,
      );
      await refresh();
    } catch {
      toastError("Could not resolve the request.");
    } finally {
      markIdle(`req-${request.id}`);
    }
  };

  const changeRole = async (email: string, role: string) => {
    const previous = users.find((user) => user.email === email)?.role;
    setUsers((current) =>
      current.map((user) => (user.email === email ? { ...user, role } : user)),
    );
    try {
      await setUserRole(email, role, token);
      toastSuccess(`${email} role is now ${role.toUpperCase()}.`);
    } catch {
      setUsers((current) =>
        current.map((user) =>
          user.email === email
            ? { ...user, role: previous ?? user.role }
            : user,
        ),
      );
      toastError("Could not update the role.");
    }
  };

  const addMember = async () => {
    const email = memberEmail.trim().toLowerCase();
    if (!email) return;
    markBusy(`member-${email}`);
    try {
      await addGrant(projectId, token, {
        subject_type: "user",
        subject_value: email,
        path: "",
        effect: "allow",
        permissions: accessFromLevel(memberLevel),
      });
      toastSuccess(`${email} added as ${memberLevel.toUpperCase()}.`);
      setMemberEmail("");
      await refresh();
    } catch {
      toastError("Could not add the member. Use a registered account email.");
    } finally {
      markIdle(`member-${email}`);
    }
  };

  const sync = async () => {
    toastProcessing("Syncing GitHub collaborators…");
    try {
      const response = await syncCollaborators(projectId, token);
      toastSuccess(`Synced ${response.data.snapshot.length} collaborators.`);
      await refresh();
    } catch {
      toastError("Collaborator sync failed.");
    }
  };

  const toggleManager = async (email: string, action: "add" | "remove") => {
    markBusy(`manager-${email}`);
    try {
      await updateManager(projectId, token, email, action);
      toastSuccess(
        action === "add"
          ? `${email} is now a project manager and can review access requests.`
          : `${email} is no longer a project manager.`,
      );
      await refresh();
    } catch (error) {
      const detail = (error as { response?: { data?: { detail?: string } } })
        .response?.data?.detail;
      toastError(detail || "Could not update the manager.");
    } finally {
      markIdle(`manager-${email}`);
    }
  };

  const copyShareLink = () => {
    const url = `${window.location.origin}/workspace?project=${encodeURIComponent(projectId)}`;
    void navigator.clipboard.writeText(url);
    toastSuccess("Share link copied.");
  };

  const runExport = async (format: "json" | "report") => {
    toastProcessing(`Exporting ${format.toUpperCase()}…`);
    try {
      const response = await exportProject(projectId, format, token);
      const blob = new Blob([JSON.stringify(response.data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${projectId}.${format === "report" ? "report.json" : "json"}`;
      anchor.click();
      URL.revokeObjectURL(url);
      toastSuccess("Export downloaded.");
    } catch {
      toastError("Export failed.");
    }
  };

  const restoreVersion = async (version: number) => {
    markBusy(`v-${version}`);
    try {
      await restorePolicyVersion(projectId, token, version);
      toastSuccess(`Restored policy version ${version}.`);
      await refresh();
    } catch {
      toastError("Could not restore the version.");
    } finally {
      markIdle(`v-${version}`);
    }
  };

  const toggleDefault = async (
    flag: keyof RepositoryPolicy["default_access"],
  ) => {
    if (!policy) return;
    markBusy(`default-${flag}`);
    try {
      const next = {
        ...policy.default_access,
        [flag]: !policy.default_access[flag],
      };
      await updateDefaultAccess(projectId, token, next);
      toastSuccess("Default access updated.");
      await refresh();
    } catch {
      toastError("Could not update default access.");
    } finally {
      markIdle(`default-${flag}`);
    }
  };

  const submitTeam = async () => {
    const name = newTeam.name.trim();
    const members = newTeam.members
      .split(/[,\n]/)
      .map((member) => member.trim())
      .filter(Boolean);
    if (!name) {
      toastError("Team name is required.");
      return;
    }
    markBusy("new-team");
    try {
      await createTeam(token, name, members, projectId);
      toastSuccess(`Team "${name}" created.`);
      setNewTeam({ name: "", members: "" });
      await refresh();
    } catch (error) {
      const detail = (error as { response?: { data?: { detail?: string } } })
        .response?.data?.detail;
      toastError(detail || "Could not create the team.");
    } finally {
      markIdle("new-team");
    }
  };

  const updateTeamMembers = async (team: Team, members: string) => {
    markBusy(`edit-${team.id}`);
    try {
      const list = members
        .split(/[,\n]/)
        .map((member) => member.trim())
        .filter(Boolean);
      await updateTeam(token, team.id, team.name, list, projectId);
      toastSuccess(`Team "${team.name}" updated.`);
      await refresh();
    } catch (error) {
      const detail = (error as { response?: { data?: { detail?: string } } })
        .response?.data?.detail;
      toastError(detail || "Could not update the team.");
    } finally {
      markIdle(`edit-${team.id}`);
    }
  };

  const removeTeam = async (team: Team) => {
    markBusy(`del-${team.id}`);
    try {
      await deleteTeam(token, team.id, projectId);
      toastSuccess(`Team "${team.name}" deleted.`);
      await refresh();
    } catch {
      toastError("Could not delete the team.");
    } finally {
      markIdle(`del-${team.id}`);
    }
  };

  const submitPathGrant = async () => {
    setFormError("");
    if (!policyPath.subjectValue.trim()) {
      setFormError("Choose a subject.");
      return;
    }
    if (!policyPath.path.trim()) {
      setFormError("Enter a file or folder path.");
      return;
    }
    markBusy("path-grant");
    try {
      await addGrant(projectId, token, {
        subject_type: policyPath.subjectType,
        subject_value: policyPath.subjectValue.trim(),
        path: policyPath.path.trim(),
        effect: policyPath.effect,
        permissions: {
          metadata: policyPath.metadata,
          graph: policyPath.graph,
          source: policyPath.source,
          download: policyPath.download,
        },
        expires_at: policyPath.expiresHours
          ? Math.floor(Date.now() / 1000) +
            Number(policyPath.expiresHours) * 3600
          : undefined,
      });
      toastSuccess("Path policy saved.");
      setPolicyPath((current) => ({
        ...current,
        path: "",
        subjectValue: "",
        expiresHours: "",
      }));
      await refresh();
    } catch {
      toastError("Could not save the path policy.");
    } finally {
      markIdle("path-grant");
    }
  };

  const removePathGrant = async (grant: RepositoryPolicy["grants"][number]) => {
    markBusy(`pg-${grant.subject_type}-${grant.subject_value}-${grant.path}`);
    try {
      await removeGrant(projectId, token, {
        subject_type: grant.subject_type,
        subject_value: grant.subject_value,
        path: grant.path,
      });
      toastSuccess("Path policy removed.");
      await refresh();
    } catch {
      toastError("Could not remove the path policy.");
    } finally {
      markIdle(`pg-${grant.subject_type}-${grant.subject_value}-${grant.path}`);
    }
  };

  const setScheduledAccess = async () => {
    setFormError("");
    if (!sched.subjectValue.trim()) {
      setFormError("Choose a subject to schedule.");
      return;
    }
    if (sched.days.length === 0) {
      setFormError("Pick at least one day.");
      return;
    }
    markBusy("sched-new");
    try {
      await addGrant(projectId, token, {
        subject_type: sched.subjectType,
        subject_value: sched.subjectValue.trim(),
        path: "",
        effect: "allow",
        permissions: accessFromLevel("source"),
        windows: [
          {
            days: [...sched.days].sort((a, b) => a - b),
            start: sched.start,
            end: sched.end,
          },
        ],
      });
      toastSuccess(`Scheduled source access for ${sched.subjectValue.trim()}.`);
      setSched((current) => ({ ...current, subjectValue: "" }));
      await refresh();
    } catch {
      toastError("Could not schedule the grant.");
    } finally {
      markIdle("sched-new");
    }
  };

  const removeScheduledGrant = async (
    grant: RepositoryPolicy["grants"][number],
  ) => {
    markBusy(`sched-${grant.subject_value}`);
    try {
      await removeGrant(projectId, token, {
        subject_type: grant.subject_type,
        subject_value: grant.subject_value,
        path: grant.path,
      });
      toastSuccess("Removed scheduled grant.");
      await refresh();
    } catch {
      toastError("Could not remove the scheduled grant.");
    } finally {
      markIdle(`sched-${grant.subject_value}`);
    }
  };

  const scheduledGrants = (policy?.grants ?? []).filter(
    (grant) => grant.windows && grant.windows.length > 0,
  );
  const pathGrants = (policy?.grants ?? []).filter(
    (grant) => grant.path && grant.path !== "",
  );
  const isOwner = (email: string) => email === policy?.owner_email;
  const isManager = (email: string) => (policy?.managers ?? []).includes(email);
  const synced = users.some((user) => user.github_login);

  const formatWindow = (
    windows: { days: number[]; start: string; end: string }[],
  ) =>
    windows
      .map((window) => {
        const names = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
        const days = window.days.map((day) => names[day]).join("/");
        return `${days} ${window.start}-${window.end}`;
      })
      .join(" + ");

  const tabs = [
    { id: "overview", label: "OVERVIEW" },
    { id: "collaborators", label: "COLLABORATORS" },
    { id: "teams", label: "TEAMS" },
    { id: "policies", label: "ACCESS POLICIES" },
    { id: "requests", label: "REQUESTS", badge: requests.length },
    { id: "settings", label: "SETTINGS" },
  ];

  return (
    <SecurityShell
      title="SECURITY CENTER"
      subtitle={policy ? `${policy.project} · ${policy.owner_email}` : "…"}
      tabs={tabs}
      active={tab}
      onSelect={setTab}
      onBack={onBack}
    >
      <div className="mx-auto w-full max-w-[960px] px-6 py-6">
        {tab === "overview" && (
          <OverviewTab
            policy={policy}
            users={users.length}
            teams={teams.length}
            requests={requests.length}
            grants={policy?.grants.length ?? 0}
            synced={synced}
            onSync={() => void sync()}
            onCopy={copyShareLink}
            onOpenRequests={() => setTab("requests")}
            onOpenCollaborators={() => setTab("collaborators")}
          />
        )}

        {tab === "collaborators" && (
          <div className="flex flex-col gap-6">
            <div>
              <SectionLabel>
                GITHUB COLLABORATORS · MEMBERS &amp; ACCESS LEVELS
              </SectionLabel>
              <p className="mb-3 max-w-[680px] text-[12px] leading-[1.6] text-[#89958f] light:text-[#61716a]">
                Members you add to this repository on GitHub appear here. Choose
                what each one can see:{" "}
                <b className="text-[#b9c1bd] light:text-[#34473f]">GRAPH</b>{" "}
                means the node is visible but the source stays locked.{" "}
                <b className="text-[#b9c1bd] light:text-[#34473f]">SOURCE</b>{" "}
                unlocks the code,{" "}
                <b className="text-[#b9c1bd] light:text-[#34473f]">FULL</b> also
                allows downloads.
              </p>
              <div className="mb-4 flex flex-wrap gap-1.5">
                {LEVEL_OPTIONS.map((level) => (
                  <span
                    key={level.id}
                    className="border border-[#39413e] px-2 py-1 font-dm text-[9px] text-[#79817e] light:border-[#c2cfc7]"
                    title={level.hint}
                  >
                    {level.label} = {level.hint.toUpperCase()}
                  </span>
                ))}
              </div>
              {policy?.source === "github" && (
                <button
                  className="mb-4 flex items-center gap-2 border border-[var(--graph-edge)] bg-[var(--graph-surface)] px-4 py-2 font-dm text-[11px] tracking-[.08em] text-[var(--graph-label)] transition-colors hover:border-[#f2b84b] hover:text-[#f2b84b] light:bg-[#f6f8f5]"
                  onClick={() => void sync()}
                >
                  <RefreshCw size={15} />
                  {synced
                    ? "RESYNC GITHUB COLLABORATORS"
                    : "SYNC GITHUB COLLABORATORS"}
                </button>
              )}
              <div className="flex flex-col gap-2">
                {users.length === 0 && (
                  <div
                    className={`${CARD} px-4 py-6 text-center font-dm text-[11px] text-[#79817e]`}
                  >
                    No members yet.
                    {policy?.source === "github"
                      ? " Connect GitHub and sync collaborators, or share the project link."
                      : " Share the project link so teammates can open it."}
                  </div>
                )}
                {users.map((user) => {
                  const grant = grantFor("user", user.email);
                  const level = isOwner(user.email)
                    ? "full"
                    : levelFromAccess(grant?.permissions);
                  const busyKey = `user:${user.email}`;
                  return (
                    <div
                      key={user.email}
                      className={`${CARD} flex items-center justify-between gap-3 px-3 py-2.5`}
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="grid h-8 w-8 shrink-0 place-items-center bg-[#2a3330] font-dm text-[12px] font-bold text-[#f2b84b] light:bg-[#e3ece7] light:text-[#398f83]">
                          {(user.name || user.email).slice(0, 1).toUpperCase()}
                        </span>
                        <div className="min-w-0">
                          <div className="truncate font-dm text-[12px] text-[#b9c1bd] light:text-[#34473f]">
                            {user.name || user.email}
                            {user.github_login
                              ? ` · @${user.github_login}`
                              : ""}
                            {isOwner(user.email) ? " · OWNER" : ""}
                          </div>
                          <div className="truncate font-dm text-[10px] text-[#79817e] light:text-[#61716a]">
                            {user.email}
                          </div>
                          {isOwner(user.email) ? (
                            <div className="mt-0.5 w-fit border border-[#64d5c4]/60 px-1.5 py-0.5 font-dm text-[8px] tracking-[.08em] text-[#64d5c4]">
                              ROLE · OWNER
                            </div>
                          ) : (
                            <div className="mt-0.5 flex w-fit items-center gap-1.5">
                              <span className="font-dm text-[8px] tracking-[.08em] text-[#79817e] light:text-[#61716a]">
                                ROLE
                              </span>
                              <select
                                value={user.role}
                                onChange={(event) =>
                                  void changeRole(
                                    user.email,
                                    event.target.value,
                                  )
                                }
                                className="border border-[#39413e] bg-[#111313] px-1.5 py-0.5 font-dm text-[9px] uppercase text-[#b9c1bd] outline-none focus:border-[#f2b84b] light:border-[#ccd8d1] light:bg-[#edf2ee] light:text-[#34473f]"
                              >
                                {ROLE_OPTIONS.map((role) => (
                                  <option key={role} value={role}>
                                    {role}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}
                        </div>
                      </div>
                      {isOwner(user.email) ? (
                        <span className="shrink-0 border border-[#64d5c4]/60 px-2 py-1 font-dm text-[9px] tracking-[.08em] text-[#64d5c4]">
                          FULL ACCESS
                        </span>
                      ) : (
                        <div className="flex shrink-0 items-center gap-2">
                          {busy.has(busyKey) && (
                            <span className="font-dm text-[9px] text-[#f2b84b]">
                              SAVING…
                            </span>
                          )}
                          <LevelPicker
                            value={level}
                            disabled={busy.has(busyKey)}
                            onChange={(nextLevel) =>
                              void setLevel("user", user.email, nextLevel)
                            }
                          />
                          {isManager(user.email) ? (
                            <button
                              className="shrink-0 border border-[#f2b84b]/60 px-2 py-1 font-dm text-[9px] tracking-[.06em] text-[#f2b84b] hover:border-[#f2b84b] disabled:opacity-40"
                              disabled={busy.has(`manager-${user.email}`)}
                              title="Remove manager — they lose the ability to review access requests and edit the policy"
                              onClick={() =>
                                void toggleManager(user.email, "remove")
                              }
                            >
                              {busy.has(`manager-${user.email}`)
                                ? "…"
                                : "MANAGER"}
                            </button>
                          ) : (
                            <button
                              className="shrink-0 border border-[#39413e] px-2 py-1 font-dm text-[9px] tracking-[.06em] text-[#79817e] hover:border-[#f2b84b] hover:text-[#f2b84b] disabled:opacity-40 light:text-[#61716a]"
                              disabled={busy.has(`manager-${user.email}`)}
                              title="Make this person a project manager — they can review access requests and manage access"
                              onClick={() =>
                                void toggleManager(user.email, "add")
                              }
                            >
                              {busy.has(`manager-${user.email}`)
                                ? "…"
                                : "MAKE MANAGER"}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              {pending.length > 0 && (
                <div className="mt-5">
                  <SectionLabel>
                    PENDING GITHUB COLLABORATORS · NO CODEATLAS ACCOUNT YET
                  </SectionLabel>
                  <p className="mb-3 max-w-[680px] text-[12px] leading-[1.6] text-[#89958f] light:text-[#61716a]">
                    These people have access on GitHub but haven't signed in
                    here yet. Once they open the project link and sign in with
                    GitHub, they're granted automatically — no manual step
                    needed.
                  </p>
                  <div className="flex flex-col gap-2">
                    {pending.map((item) => (
                      <div
                        key={item.login}
                        className={`${CARD} flex items-center justify-between gap-3 px-3 py-2.5`}
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="grid h-8 w-8 shrink-0 place-items-center bg-[#2a3330] font-dm text-[12px] font-bold text-[#f2b84b] light:bg-[#e3ece7] light:text-[#398f83]">
                            @
                          </span>
                          <div className="min-w-0">
                            <div className="truncate font-dm text-[12px] text-[#b9c1bd] light:text-[#34473f]">
                              @{item.login}
                            </div>
                            <div className="mt-0.5 w-fit border border-[#f2b84b]/60 px-1.5 py-0.5 font-dm text-[8px] tracking-[.08em] text-[#f2b84b]">
                              {item.permission.toUpperCase()} ON GITHUB
                            </div>
                          </div>
                        </div>
                        <button
                          className="shrink-0 border border-[#64d5c4]/60 px-3 py-1.5 font-dm text-[9px] tracking-[.08em] text-[#64d5c4] hover:bg-[#64d5c4]/10"
                          onClick={copyShareLink}
                        >
                          COPY SHARE LINK
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="mt-3 flex max-w-[680px] flex-wrap items-center gap-2">
                <input
                  type="email"
                  value={memberEmail}
                  onChange={(event) => setMemberEmail(event.target.value)}
                  placeholder="Add a member by email…"
                  className="min-w-0 flex-1 border border-[#39413e] bg-[#111313] px-3 py-2 font-dm text-[10px] text-[#b9c1bd] outline-none placeholder:text-[#59635e] focus:border-[#f2b84b] light:border-[#ccd8d1] light:bg-[#edf2ee] light:text-[#34473f]"
                />
                <select
                  value={memberLevel}
                  onChange={(event) =>
                    setMemberLevel(event.target.value as AccessLevel)
                  }
                  className="border border-[#39413e] bg-[#111313] px-2 py-2 font-dm text-[10px] uppercase text-[#b9c1bd] outline-none light:border-[#ccd8d1] light:bg-[#edf2ee] light:text-[#34473f]"
                >
                  {LEVEL_OPTIONS.filter((level) => level.id !== "none").map(
                    (level) => (
                      <option key={level.id} value={level.id}>
                        {level.label}
                      </option>
                    ),
                  )}
                </select>
                <button
                  className="shrink-0 border border-[#64d5c4]/60 px-4 py-2 font-dm text-[10px] tracking-[.08em] text-[#64d5c4] hover:bg-[#64d5c4]/10 disabled:opacity-40"
                  disabled={
                    !memberEmail.trim() ||
                    busy.has(`member-${memberEmail.trim().toLowerCase()}`)
                  }
                  onClick={() => void addMember()}
                >
                  {busy.has(`member-${memberEmail.trim().toLowerCase()}`)
                    ? "ADDING…"
                    : "ADD MEMBER"}
                </button>
              </div>
            </div>

            <div>
              <SectionLabel>
                PROJECT MANAGERS · CAN REVIEW ACCESS REQUESTS
              </SectionLabel>
              <p className="mb-3 max-w-[680px] text-[12px] leading-[1.6] text-[#89958f] light:text-[#61716a]">
                Managers can open this repository's security center: review
                access requests, set access levels, and edit the policy —
                without owning the repository.
              </p>
              <div className="flex flex-col gap-2">
                <div
                  className={`${CARD} flex items-center justify-between gap-3 px-3 py-2.5`}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid h-8 w-8 shrink-0 place-items-center bg-[#2a3330] font-dm text-[12px] font-bold text-[#f2b84b] light:bg-[#e3ece7] light:text-[#398f83]">
                      {(policy?.owner_email ?? "?").slice(0, 1).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <div className="truncate font-dm text-[12px] text-[#b9c1bd] light:text-[#34473f]">
                        {policy?.owner_email} · OWNER
                      </div>
                      <div className="truncate font-dm text-[10px] text-[#79817e] light:text-[#61716a]">
                        Always a manager
                      </div>
                    </div>
                  </div>
                  <span className="shrink-0 border border-[#f2b84b]/60 px-2 py-1 font-dm text-[9px] tracking-[.08em] text-[#f2b84b]">
                    MANAGER
                  </span>
                </div>
                <div className="flex max-w-[560px] items-center gap-2">
                  <input
                    type="email"
                    value={managerEmail}
                    onChange={(event) => setManagerEmail(event.target.value)}
                    placeholder="person@company.com"
                    className="min-w-0 flex-1 border border-[#39413e] bg-[#111313] px-3 py-2 font-dm text-[10px] text-[#b9c1bd] outline-none placeholder:text-[#59635e] focus:border-[#f2b84b] light:border-[#ccd8d1] light:bg-[#edf2ee] light:text-[#34473f]"
                  />
                  <button
                    className="shrink-0 border border-[#64d5c4]/60 px-4 py-2 font-dm text-[10px] tracking-[.08em] text-[#64d5c4] hover:bg-[#64d5c4]/10 disabled:opacity-40"
                    disabled={busy.has("manager-add") || !managerEmail.trim()}
                    onClick={() => {
                      void toggleManager(
                        managerEmail.trim().toLowerCase(),
                        "add",
                      ).then(() => setManagerEmail(""));
                    }}
                  >
                    {busy.has("manager-add") ? "ADDING…" : "ADD MANAGER"}
                  </button>
                </div>
                {(policy?.managers ?? []).length === 0 ? (
                  <div
                    className={`${CARD} px-4 py-4 text-center font-dm text-[11px] text-[#79817e]`}
                  >
                    No additional managers. Type an email above or use{" "}
                    <b>MAKE MANAGER</b> next to a member to assign someone.
                  </div>
                ) : (
                  (policy?.managers ?? []).map((email) => (
                    <div
                      key={email}
                      className={`${CARD} flex items-center justify-between gap-3 px-3 py-2.5`}
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="grid h-8 w-8 shrink-0 place-items-center bg-[#2a3330] font-dm text-[12px] font-bold text-[#f2b84b] light:bg-[#e3ece7] light:text-[#398f83]">
                          {email.slice(0, 1).toUpperCase()}
                        </span>
                        <div className="min-w-0">
                          <div className="truncate font-dm text-[12px] text-[#b9c1bd] light:text-[#34473f]">
                            {email}
                          </div>
                          <div className="truncate font-dm text-[10px] text-[#79817e] light:text-[#61716a]">
                            {users.find((user) => user.email === email)?.name ||
                              "Assigned manager"}
                          </div>
                        </div>
                      </div>
                      <button
                        className="shrink-0 border border-[#39413e] px-2 py-1 font-dm text-[9px] tracking-[.06em] text-[#f17c71] hover:border-[#f17c71] disabled:opacity-40"
                        disabled={busy.has(`manager-${email}`)}
                        onClick={() => void toggleManager(email, "remove")}
                      >
                        {busy.has(`manager-${email}`) ? "…" : "REMOVE"}
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div>
              <SectionLabel>
                SCHEDULED ACCESS · TIME-WINDOWED GRANTS
              </SectionLabel>
              {scheduledGrants.length > 0 && (
                <div className="mb-3 flex flex-col gap-1.5">
                  {scheduledGrants.map((grant) => (
                    <div
                      key={`${grant.subject_type}-${grant.subject_value}-${grant.path}`}
                      className={`${CARD} flex items-center justify-between gap-2 px-3 py-2`}
                    >
                      <div className="min-w-0">
                        <div className="truncate font-dm text-[11px] text-[#b9c1bd] light:text-[#34473f]">
                          {grant.subject_type === "team"
                            ? `TEAM · ${grant.subject_value}`
                            : grant.subject_value}
                        </div>
                        <div className="truncate font-dm text-[9px] text-[#79817e] light:text-[#61716a]">
                          {formatWindow(grant.windows ?? [])}
                        </div>
                      </div>
                      <button
                        className="shrink-0 border border-[#39413e] px-2 py-1 font-dm text-[9px] tracking-[.06em] text-[#f17c71] hover:border-[#f17c71] disabled:opacity-40"
                        disabled={busy.has(`sched-${grant.subject_value}`)}
                        onClick={() => void removeScheduledGrant(grant)}
                      >
                        DELETE
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className={`${CARD} flex flex-col gap-2 p-3`}>
                <div className="flex items-center gap-2">
                  <select
                    className="shrink-0 border border-[#39413e] bg-[#111313] px-2 py-1.5 font-dm text-[10px] text-[#b9c1bd] outline-none light:border-[#ccd8d1] light:bg-[#edf2ee] light:text-[#34473f]"
                    value={sched.subjectType}
                    onChange={(event) =>
                      setSched({
                        ...sched,
                        subjectType: event.target.value,
                        subjectValue: "",
                      })
                    }
                  >
                    <option value="user">USER</option>
                    <option value="team">TEAM</option>
                  </select>
                  <select
                    className="min-w-0 flex-1 border border-[#39413e] bg-[#111313] px-2 py-1.5 font-dm text-[10px] text-[#b9c1bd] outline-none light:border-[#ccd8d1] light:bg-[#edf2ee] light:text-[#34473f]"
                    value={sched.subjectValue}
                    onChange={(event) =>
                      setSched({ ...sched, subjectValue: event.target.value })
                    }
                  >
                    <option value="">SELECT SUBJECT</option>
                    {sched.subjectType === "user"
                      ? users
                          .filter((user) => !isOwner(user.email))
                          .map((user) => (
                            <option key={user.email} value={user.email}>
                              {user.email}
                            </option>
                          ))
                      : teams.map((team) => (
                          <option key={team.id} value={team.id}>
                            {team.name}
                          </option>
                        ))}
                  </select>
                </div>
                <div className="flex items-center gap-1">
                  {["M", "T", "W", "T", "F", "S", "S"].map((label, index) => (
                    <button
                      key={index}
                      className={`h-7 flex-1 border font-dm text-[10px] ${sched.days.includes(index) ? "border-[#64d5c4] text-[#64d5c4]" : "border-[#39413e] text-[#79817e] hover:border-[#64d5c4]/50"}`}
                      onClick={() =>
                        setSched({
                          ...sched,
                          days: sched.days.includes(index)
                            ? sched.days.filter((day) => day !== index)
                            : [...sched.days, index],
                        })
                      }
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    className="min-w-0 flex-1 border border-[#39413e] bg-[#111313] px-2 py-1.5 font-dm text-[10px] text-[#b9c1bd] outline-none light:border-[#ccd8d1] light:bg-[#edf2ee] light:text-[#34473f]"
                    value={sched.start}
                    onChange={(event) =>
                      setSched({ ...sched, start: event.target.value })
                    }
                  />
                  <span className="font-dm text-[10px] text-[#79817e]">TO</span>
                  <input
                    type="time"
                    className="min-w-0 flex-1 border border-[#39413e] bg-[#111313] px-2 py-1.5 font-dm text-[10px] text-[#b9c1bd] outline-none light:border-[#ccd8d1] light:bg-[#edf2ee] light:text-[#34473f]"
                    value={sched.end}
                    onChange={(event) =>
                      setSched({ ...sched, end: event.target.value })
                    }
                  />
                  <button
                    className="shrink-0 border border-[#64d5c4]/60 px-3 py-1.5 font-dm text-[10px] tracking-[.06em] text-[#64d5c4] hover:bg-[#64d5c4]/10 disabled:opacity-40"
                    disabled={busy.has("sched-new")}
                    onClick={() => void setScheduledAccess()}
                  >
                    SET SCHEDULE
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === "teams" && (
          <div className="flex flex-col gap-6">
            <div>
              <SectionLabel>CREATE TEAM</SectionLabel>
              <div className={`${CARD} flex flex-col gap-2 p-3`}>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Team name"
                    className="min-w-0 flex-1 border border-[#39413e] bg-[#111313] px-3 py-2 font-dm text-[11px] text-[#b9c1bd] outline-none placeholder:text-[#79817e] focus:border-[#64d5c4] light:border-[#ccd8d1] light:bg-[#edf2ee] light:text-[#34473f]"
                    value={newTeam.name}
                    onChange={(event) =>
                      setNewTeam((current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                  />
                  <input
                    type="text"
                    placeholder="Members (emails, comma separated)"
                    className="min-w-0 flex-[2] border border-[#39413e] bg-[#111313] px-3 py-2 font-dm text-[11px] text-[#b9c1bd] outline-none placeholder:text-[#79817e] focus:border-[#64d5c4] light:border-[#ccd8d1] light:bg-[#edf2ee] light:text-[#34473f]"
                    value={newTeam.members}
                    onChange={(event) =>
                      setNewTeam((current) => ({
                        ...current,
                        members: event.target.value,
                      }))
                    }
                  />
                  <button
                    className="shrink-0 border border-[#64d5c4]/60 px-4 py-2 font-dm text-[10px] tracking-[.08em] text-[#64d5c4] hover:bg-[#64d5c4]/10 disabled:opacity-40"
                    disabled={busy.has("new-team")}
                    onClick={() => void submitTeam()}
                  >
                    CREATE
                  </button>
                </div>
              </div>
            </div>
            <div>
              <SectionLabel>TEAMS ({teams.length})</SectionLabel>
              {teams.length === 0 && (
                <div
                  className={`${CARD} px-4 py-6 text-center font-dm text-[11px] text-[#79817e]`}
                >
                  No teams yet. Group collaborators and grant one access level
                  to the whole team.
                </div>
              )}
              <div className="flex flex-col gap-2">
                {teams.map((team) => {
                  const grant = grantFor("team", team.id);
                  const level = levelFromAccess(grant?.permissions);
                  return (
                    <div key={team.id} className={`${CARD} px-3 py-2.5`}>
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate font-dm text-[12px] text-[#b9c1bd] light:text-[#34473f]">
                            {team.name}
                          </div>
                          <div className="truncate font-dm text-[10px] text-[#79817e] light:text-[#61716a]">
                            {team.members.length} MEMBER
                            {team.members.length === 1 ? "" : "S"}
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <LevelPicker
                            value={level}
                            disabled={busy.has(`team:${team.id}`)}
                            onChange={(nextLevel) =>
                              void setLevel("team", team.id, nextLevel)
                            }
                          />
                          <button
                            className="border border-[#39413e] px-2 py-1 font-dm text-[9px] tracking-[.06em] text-[#f17c71] hover:border-[#f17c71] disabled:opacity-40 light:border-[#c2cfc7]"
                            disabled={busy.has(`del-${team.id}`)}
                            onClick={() => void removeTeam(team)}
                          >
                            DELETE
                          </button>
                        </div>
                      </div>
                      <TeamMembersEditor
                        team={team}
                        busy={busy.has(`edit-${team.id}`)}
                        onSave={updateTeamMembers}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {tab === "policies" && (
          <div className="flex flex-col gap-6">
            <div>
              <SectionLabel>
                FILE / FOLDER POLICY · PATH-LEVEL OVERRIDES
              </SectionLabel>
              <p className="mb-3 max-w-[680px] text-[12px] leading-[1.6] text-[#89958f] light:text-[#61716a]">
                Add rules for a specific file or folder. These override the
                member&apos;s repository-level access. Use{" "}
                <b className="text-[#f17c71]">DENY</b> to block a path
                (including secrets) even for members with source access.
              </p>
              <div className={`${CARD} flex flex-col gap-2 p-3`}>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    className="border border-[#39413e] bg-[#111313] px-2 py-1.5 font-dm text-[10px] text-[#b9c1bd] outline-none light:border-[#ccd8d1] light:bg-[#edf2ee] light:text-[#34473f]"
                    value={policyPath.subjectType}
                    onChange={(event) =>
                      setPolicyPath({
                        ...policyPath,
                        subjectType: event.target.value,
                        subjectValue: "",
                      })
                    }
                  >
                    <option value="user">USER</option>
                    <option value="team">TEAM</option>
                  </select>
                  <select
                    className="min-w-0 flex-1 border border-[#39413e] bg-[#111313] px-2 py-1.5 font-dm text-[10px] text-[#b9c1bd] outline-none light:border-[#ccd8d1] light:bg-[#edf2ee] light:text-[#34473f]"
                    value={policyPath.subjectValue}
                    onChange={(event) =>
                      setPolicyPath({
                        ...policyPath,
                        subjectValue: event.target.value,
                      })
                    }
                  >
                    <option value="">SELECT SUBJECT</option>
                    {policyPath.subjectType === "user"
                      ? users
                          .filter((user) => !isOwner(user.email))
                          .map((user) => (
                            <option key={user.email} value={user.email}>
                              {user.email}
                            </option>
                          ))
                      : teams.map((team) => (
                          <option key={team.id} value={team.id}>
                            {team.name}
                          </option>
                        ))}
                  </select>
                  <select
                    className={`border px-2 py-1.5 font-dm text-[10px] outline-none ${policyPath.effect === "deny" ? "border-[#f17c71]/60 bg-[#111313] text-[#f17c71]" : "border-[#39413e] bg-[#111313] text-[#64d5c4]"} light:bg-[#edf2ee]`}
                    value={policyPath.effect}
                    onChange={(event) =>
                      setPolicyPath({
                        ...policyPath,
                        effect: event.target.value as "allow" | "deny",
                      })
                    }
                  >
                    <option value="allow">ALLOW</option>
                    <option value="deny">DENY</option>
                  </select>
                  <input
                    type="text"
                    placeholder="path — e.g. src/backend/secrets/"
                    className="min-w-0 flex-1 border border-[#39413e] bg-[#111313] px-3 py-1.5 font-dm text-[10px] text-[#b9c1bd] outline-none placeholder:text-[#79817e] focus:border-[#64d5c4] light:border-[#ccd8d1] light:bg-[#edf2ee] light:text-[#34473f]"
                    value={policyPath.path}
                    onChange={(event) =>
                      setPolicyPath({ ...policyPath, path: event.target.value })
                    }
                  />
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  {(["metadata", "graph", "source", "download"] as const).map(
                    (flag) => (
                      <label
                        key={flag}
                        className="flex cursor-pointer items-center gap-1.5 font-dm text-[10px] text-[#b9c1bd] light:text-[#34473f]"
                      >
                        <input
                          type="checkbox"
                          checked={policyPath[flag]}
                          onChange={(event) =>
                            setPolicyPath({
                              ...policyPath,
                              [flag]: event.target.checked,
                            })
                          }
                          className="accent-[#64d5c4]"
                        />
                        {flag.toUpperCase()}
                      </label>
                    ),
                  )}
                  <input
                    type="number"
                    min="1"
                    placeholder="expires (hours)"
                    className="w-28 border border-[#39413e] bg-[#111313] px-2 py-1.5 font-dm text-[10px] text-[#b9c1bd] outline-none placeholder:text-[#79817e] light:border-[#ccd8d1] light:bg-[#edf2ee] light:text-[#34473f]"
                    value={policyPath.expiresHours}
                    onChange={(event) =>
                      setPolicyPath({
                        ...policyPath,
                        expiresHours: event.target.value,
                      })
                    }
                  />
                  <button
                    className="ml-auto border border-[#64d5c4]/60 px-4 py-1.5 font-dm text-[10px] tracking-[.08em] text-[#64d5c4] hover:bg-[#64d5c4]/10 disabled:opacity-40"
                    disabled={busy.has("path-grant")}
                    onClick={() => void submitPathGrant()}
                  >
                    ADD RULE
                  </button>
                </div>
                {formError && (
                  <div className="font-dm text-[10px] text-[#f17c71]">
                    {formError}
                  </div>
                )}
              </div>
            </div>
            <div>
              <SectionLabel>
                ACTIVE PATH RULES ({pathGrants.length})
              </SectionLabel>
              {pathGrants.length === 0 && (
                <div
                  className={`${CARD} px-4 py-6 text-center font-dm text-[11px] text-[#79817e]`}
                >
                  No path overrides. Members follow their repository-level
                  access.
                </div>
              )}
              <div className="flex flex-col gap-1.5">
                {pathGrants.map((grant) => (
                  <div
                    key={`${grant.subject_type}-${grant.subject_value}-${grant.path}`}
                    className={`${CARD} flex items-center justify-between gap-2 px-3 py-2`}
                  >
                    <div className="min-w-0">
                      <div className="truncate font-dm text-[11px] text-[#b9c1bd] light:text-[#34473f]">
                        <span
                          className={
                            grant.effect === "deny"
                              ? "text-[#f17c71]"
                              : "text-[#64d5c4]"
                          }
                        >
                          {grant.effect === "deny" ? "DENY" : "ALLOW"}
                        </span>{" "}
                        · {grant.path}
                      </div>
                      <div className="truncate font-dm text-[9px] text-[#79817e] light:text-[#61716a]">
                        {grant.subject_type === "team"
                          ? `TEAM · ${grant.subject_value}`
                          : grant.subject_value}
                        {grant.expires_at
                          ? ` · expires ${new Date(grant.expires_at * 1000).toLocaleString()}`
                          : ""}
                        {grant.windows && grant.windows.length > 0
                          ? ` · ${formatWindow(grant.windows)}`
                          : ""}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <div className="hidden flex-wrap gap-1 sm:flex">
                        {(["metadata", "graph", "source", "download"] as const)
                          .filter((flag) => grant.permissions[flag])
                          .map((flag) => (
                            <span
                              key={flag}
                              className="border border-[#39413e] px-1.5 py-0.5 font-dm text-[8px] text-[#79817e] light:border-[#c2cfc7]"
                            >
                              {flag.toUpperCase()}
                            </span>
                          ))}
                      </div>
                      <button
                        className="border border-[#39413e] px-2 py-1 font-dm text-[9px] tracking-[.06em] text-[#f17c71] hover:border-[#f17c71] disabled:opacity-40 light:border-[#c2cfc7]"
                        disabled={busy.has(
                          `pg-${grant.subject_type}-${grant.subject_value}-${grant.path}`,
                        )}
                        onClick={() => void removePathGrant(grant)}
                      >
                        REMOVE
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === "requests" && (
          <div>
            <SectionLabel>
              PENDING ACCESS REQUESTS ({requests.length})
            </SectionLabel>
            {requests.length === 0 ? (
              <div className={`${CARD} px-4 py-10 text-center`}>
                <div className="font-dm text-[12px] text-[#b9c1bd] light:text-[#34473f]">
                  No pending requests.
                </div>
                <p className="mt-2 font-dm text-[10px] text-[#79817e] light:text-[#61716a]">
                  When a collaborator clicks a locked file and requests access,
                  it appears here.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {requests.map((request) => (
                  <div key={request.id} className={`${CARD} p-4`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-dm text-[12px] text-[#b9c1bd] light:text-[#34473f]">
                          {request.requester_name} · {request.requester_email}
                        </div>
                        <div className="mt-1 truncate font-dm text-[11px] text-[#f2b84b]">
                          {request.resource_path || "(entire repository)"}
                        </div>
                        <div className="mt-1 font-dm text-[10px] leading-[1.5] text-[#89958f] light:text-[#61716a]">
                          “{request.reason}”
                        </div>
                        <div className="mt-1 font-dm text-[9px] text-[#79817e] light:text-[#61716a]">
                          {new Date(request.created_at * 1000).toLocaleString()}
                        </div>
                      </div>
                      <span className="shrink-0 border border-[#f2b84b]/60 px-2 py-0.5 font-dm text-[9px] text-[#f2b84b]">
                        {request.permission.toUpperCase()}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <button
                        className="flex-1 border border-[#64d5c4]/60 py-1.5 font-dm text-[10px] tracking-[.06em] text-[#64d5c4] hover:bg-[#64d5c4]/10 disabled:opacity-40"
                        disabled={busy.has(`req-${request.id}`)}
                        onClick={() => void resolve(request, "approve")}
                      >
                        APPROVE
                      </button>
                      <button
                        className="flex-1 border border-[#39413e] py-1.5 font-dm text-[10px] tracking-[.06em] text-[#79817e] hover:border-[#f17c71] hover:text-[#f17c71] disabled:opacity-40 light:border-[#c2cfc7]"
                        disabled={busy.has(`req-${request.id}`)}
                        onClick={() => void resolve(request, "reject")}
                      >
                        REJECT
                      </button>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          min="1"
                          placeholder="hours"
                          className="w-16 border border-[#39413e] bg-[#111313] px-2 py-1.5 font-dm text-[10px] text-[#b9c1bd] outline-none placeholder:text-[#79817e] light:border-[#ccd8d1] light:bg-[#edf2ee] light:text-[#34473f]"
                          value={tempHours[request.id] ?? ""}
                          onChange={(event) =>
                            setTempHours((current) => ({
                              ...current,
                              [request.id]: event.target.value,
                            }))
                          }
                        />
                        <button
                          className="flex-1 border border-[#f2b84b]/60 px-3 py-1.5 font-dm text-[10px] tracking-[.06em] text-[#f2b84b] hover:bg-[#f2b84b]/10 disabled:opacity-40"
                          disabled={busy.has(`req-${request.id}`)}
                          onClick={() => void resolve(request, "temporary")}
                        >
                          TEMP ({tempHours[request.id] || "0"}H)
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "settings" && (
          <div className="flex flex-col gap-8">
            <div>
              <SectionLabel>DEFAULT REPOSITORY ACCESS</SectionLabel>
              <p className="mb-3 max-w-[680px] text-[12px] leading-[1.6] text-[#89958f] light:text-[#61716a]">
                What everyone can do with this repository by default, before any
                member or team grants are applied.
              </p>
              <div className="flex flex-wrap gap-2">
                {policy &&
                  (
                    Object.keys(
                      policy.default_access,
                    ) as (keyof RepositoryPolicy["default_access"])[]
                  ).map((flag) => (
                    <button
                      key={flag}
                      className={`flex items-center gap-2 border px-3 py-1.5 font-dm text-[10px] tracking-[.06em] disabled:opacity-40 ${policy.default_access[flag] ? "border-[#64d5c4] text-[#64d5c4]" : "border-[#39413e] text-[#79817e] hover:border-[#f2b84b] hover:text-[#f2b84b] light:border-[#c2cfc7]"}`}
                      disabled={busy.has(`default-${flag}`)}
                      onClick={() => void toggleDefault(flag)}
                    >
                      {flag.toUpperCase()}{" "}
                      {policy.default_access[flag] ? "✓" : "✗"}
                    </button>
                  ))}
              </div>
            </div>

            <div>
              <SectionLabel>EXPORT · PERMISSION-AWARE</SectionLabel>
              <div className="flex max-w-[400px] gap-2">
                <button
                  className="flex-1 border border-[#39413e] py-2 font-dm text-[10px] tracking-[.06em] text-[#79817e] hover:border-[#f2b84b] hover:text-[#f2b84b] light:border-[#c2cfc7]"
                  onClick={() => void runExport("json")}
                >
                  GRAPH JSON
                </button>
                <button
                  className="flex-1 border border-[#39413e] py-2 font-dm text-[10px] tracking-[.06em] text-[#79817e] hover:border-[#f2b84b] hover:text-[#f2b84b] light:border-[#c2cfc7]"
                  onClick={() => void runExport("report")}
                >
                  ARCHITECTURE REPORT
                </button>
              </div>
            </div>

            <div>
              <SectionLabel>SHARE</SectionLabel>
              <div className="flex max-w-[560px] items-center gap-2">
                <code className="min-w-0 flex-1 truncate border border-[#2a3330] bg-[#171a1a] px-3 py-2 font-dm text-[10px] text-[#64d5c4] light:border-[#d3ddd6] light:bg-[#f6f8f5]">
                  {window.location.origin}/workspace?project={projectId}
                </code>
                <button
                  className="shrink-0 border border-[#64d5c4]/60 px-4 py-2 font-dm text-[10px] tracking-[.08em] text-[#64d5c4] hover:bg-[#64d5c4]/10"
                  onClick={copyShareLink}
                >
                  COPY LINK
                </button>
              </div>
            </div>

            {versions.length > 0 && (
              <div>
                <SectionLabel>POLICY HISTORY ({versions.length})</SectionLabel>
                <div className="flex max-w-[560px] flex-col gap-1.5">
                  {versions
                    .slice()
                    .reverse()
                    .map((version) => (
                      <div
                        key={version.version}
                        className={`${CARD} flex items-center justify-between gap-2 px-3 py-2`}
                      >
                        <div className="min-w-0">
                          <div className="font-dm text-[11px] text-[#b9c1bd] light:text-[#34473f]">
                            v{version.version} ·{" "}
                            {version.note || "policy updated"}
                          </div>
                          <div className="truncate font-dm text-[9px] text-[#79817e] light:text-[#61716a]">
                            {version.actor || "system"} ·{" "}
                            {version.ts
                              ? new Date(version.ts * 1000).toLocaleString()
                              : ""}
                          </div>
                        </div>
                        <button
                          className="shrink-0 border border-[#39413e] px-2 py-1 font-dm text-[9px] tracking-[.06em] text-[#79817e] hover:border-[#f2b84b] hover:text-[#f2b84b] disabled:opacity-40 light:border-[#c2cfc7]"
                          disabled={busy.has(`v-${version.version}`)}
                          onClick={() => void restoreVersion(version.version)}
                        >
                          RESTORE
                        </button>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </SecurityShell>
  );
}

function OverviewTab({
  policy,
  users,
  teams,
  requests,
  grants,
  synced,
  onSync,
  onCopy,
  onOpenRequests,
  onOpenCollaborators,
}: {
  policy: RepositoryPolicy | null;
  users: number;
  teams: number;
  requests: number;
  grants: number;
  synced: boolean;
  onSync: () => void;
  onCopy: () => void;
  onOpenRequests: () => void;
  onOpenCollaborators: () => void;
}) {
  const stats = [
    ["MEMBERS", users],
    ["TEAMS", teams],
    ["GRANTS", grants],
    ["MANAGERS", (policy?.managers?.length ?? 0) + 1],
    ["PENDING REQUESTS", requests],
  ];
  return (
    <div className="flex flex-col gap-6">
      <div>
        <SectionLabel>SECURITY OVERVIEW</SectionLabel>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {stats.map(([label, value]) => (
            <div key={label} className={`${CARD} px-4 py-3`}>
              <div className="font-dm text-[20px] text-[#64d5c4]">
                {String(value)}
              </div>
              <div className="mt-1 font-dm text-[9px] tracking-[.08em] text-[#6d7974] light:text-[#61716a]">
                {label}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <SectionLabel>SET UP COLLABORATION</SectionLabel>
        <div className={`${CARD} flex flex-col`}>
          <ChecklistRow
            done
            label="Project imported & analyzed"
            detail={
              policy
                ? `${policy.project} · ${policy.source.toUpperCase()}`
                : "…"
            }
          />
          {policy?.source === "github" ? (
            <ChecklistRow
              done={synced}
              label="Sync GitHub collaborators"
              detail={
                synced
                  ? "Collaborators pulled from GitHub"
                  : "Members you added on GitHub appear here"
              }
              actionLabel={synced ? "RESYNC" : "SYNC NOW"}
              onAction={onSync}
            />
          ) : (
            <ChecklistRow
              done={users > 0}
              label="Invite collaborators"
              detail="Share the project link — members see the graph, you control access"
            />
          )}
          <ChecklistRow
            done={grants > 0}
            label="Assign access levels"
            detail={
              grants > 0
                ? `${grants} grant${grants === 1 ? "" : "s"} active`
                : "GRAPH / SOURCE / FULL per member"
            }
            actionLabel="ASSIGN"
            onAction={onOpenCollaborators}
          />
          <ChecklistRow
            done
            label="Share the map"
            detail="Anyone with the link can open the architecture graph"
            actionLabel="COPY LINK"
            onAction={onCopy}
          />
          <ChecklistRow
            done={requests === 0}
            label="Review access requests"
            detail={
              requests > 0
                ? `${requests} pending request${requests === 1 ? "" : "s"}`
                : "No pending requests"
            }
            actionLabel={requests > 0 ? "REVIEW" : undefined}
            onAction={requests > 0 ? onOpenRequests : undefined}
            badge={requests}
          />
        </div>
      </div>
    </div>
  );
}

function ChecklistRow({
  done,
  label,
  detail,
  actionLabel,
  onAction,
  badge,
}: {
  done: boolean;
  label: string;
  detail: string;
  actionLabel?: string;
  onAction?: () => void;
  badge?: number;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[#2a3330] px-4 py-3 last:border-b-0 light:border-[#d3ddd6]">
      <div className="flex min-w-0 items-center gap-3">
        <span
          className={`grid h-5 w-5 shrink-0 place-items-center border font-dm text-[10px] ${done ? "border-[#64d5c4] text-[#64d5c4]" : "border-[#39413e] text-[#79817e]"}`}
        >
          {done ? "✓" : "·"}
        </span>
        <div className="min-w-0">
          <div className="truncate font-dm text-[12px] text-[#b9c1bd] light:text-[#34473f]">
            {label}
            {badge ? ` (${badge})` : ""}
          </div>
          <div className="truncate font-dm text-[10px] text-[#79817e] light:text-[#61716a]">
            {detail}
          </div>
        </div>
      </div>
      {actionLabel && onAction && (
        <button
          className="shrink-0 border border-[#f2b84b]/50 px-3 py-1.5 font-dm text-[10px] tracking-[.08em] text-[#f2b84b] hover:bg-[#f2b84b]/10"
          onClick={onAction}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

function TeamMembersEditor({
  team,
  busy,
  onSave,
}: {
  team: Team;
  busy: boolean;
  onSave: (team: Team, members: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState(team.members.join(", "));
  useEffect(() => {
    setDraft(team.members.join(", "));
  }, [team.members]);
  return (
    <div className="mt-2 flex items-center gap-1.5">
      <input
        type="text"
        placeholder="member emails"
        className="min-w-0 flex-1 border border-[#2a3330] bg-[#111313] px-2 py-1 font-dm text-[10px] text-[#b9c1bd] outline-none placeholder:text-[#79817e] light:border-[#ccd8d1] light:bg-[#edf2ee] light:text-[#34473f]"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
      />
      <button
        className="shrink-0 border border-[#39413e] px-2 py-1 font-dm text-[9px] tracking-[.06em] text-[#79817e] hover:border-[#64d5c4] hover:text-[#64d5c4] disabled:opacity-40 light:border-[#c2cfc7]"
        disabled={busy}
        onClick={() => void onSave(team, draft)}
      >
        SAVE
      </button>
    </div>
  );
}

export default SecurityCenter;
