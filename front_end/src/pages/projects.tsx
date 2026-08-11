import { useCallback, useEffect, useRef, useState } from "react";
import type { ChangeEvent, ReactNode } from "react";
import { Trash2, FolderOpen, Users } from "lucide-react";
import EmptyState from "../components/empty-state";
import TopBar from "../components/workspace/topbar";
import LandingView from "../components/workspace/landing-view";
import ParsingScreen from "../components/parsing";
import { useNavigation } from "../services/navigation";
import { deleteProject, listDeveloperProjects, revokeProjectMembership, updateProjectStatus } from "../services/api";
import { InlineLoader } from "../components/premium-loader";
import { toastError, toastSuccess } from "../services/toast";
import { useLiveEvents } from "../hooks/useLiveEvents";
import type { DeveloperProject, ProjectGraph, ProjectStatus } from "../types/project";
import type { CurrentUser, GitHubRepo } from "../services/api";

type ProjectsProps = {
  onLogout: () => void;
  theme: "dark" | "light";
  onToggleTheme: () => void;
  onOpenProfile: () => void;
  onOpenSettings: () => void;
  user?: CurrentUser | null;
};

function Projects({
  onLogout,
  theme,
  onToggleTheme,
  onOpenProfile,
  onOpenSettings,
  user,
}: ProjectsProps) {
  const { navigate } = useNavigation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<"projects" | "collab" | "add">("projects");
  const [projects, setProjects] = useState<DeveloperProject[] | null>(null);
  const [listError, setListError] = useState("");
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");
  const [githubUrl, setGithubUrl] = useState("");
  const [parsingFile, setParsingFile] = useState<File | null>(null);
  const [parsingRepoUrl, setParsingRepoUrl] = useState("");
  const [parsingConnectedRepo, setParsingConnectedRepo] =
    useState<GitHubRepo | null>(null);
  const [parsingUploadId, setParsingUploadId] = useState("");
  const [deletingId, setDeletingId] = useState("");
  const token = localStorage.getItem("codeatlas-token") ?? "";

  const loadProjects = useCallback(async () => {
    try {
      const response = await listDeveloperProjects(token);
      setProjects(response.data.projects);
      setListError("");
    } catch {
      setListError("Could not load your projects.");
    }
  }, [token]);

  const handleParseComplete = useCallback((nextGraph: ProjectGraph) => {
    navigate("home", { state: { graph: nextGraph } });
    void loadProjects();
  }, [loadProjects, navigate]);

  const handleParseError = useCallback((message: string) => {
    setError(message);
    setParsingFile(null);
    setParsingRepoUrl("");
    setParsingConnectedRepo(null);
  }, []);

  const handleParseCancel = useCallback(() => {
    setParsingFile(null);
    setParsingRepoUrl("");
    setParsingConnectedRepo(null);
    setError("Upload cancelled.");
  }, []);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useLiveEvents(() => {
    if (refreshTimerRef.current) return;
    refreshTimerRef.current = setTimeout(() => {
      refreshTimerRef.current = null;
      void loadProjects();
    }, 400);
  });

  const chooseFile = (file?: File) => {
    if (!file) return;
    setError("");
    const uploadId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    setParsingUploadId(uploadId);
    setParsingFile(file);
    setParsingRepoUrl("");
    setParsingConnectedRepo(null);
  };

  const chooseGithubUrl = () => {
    const url = githubUrl.trim();
    if (!url) {
      setError("Enter a GitHub repository URL.");
      return;
    }
    setError("");
    const uploadId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    setParsingUploadId(uploadId);
    setParsingRepoUrl(url);
    setParsingFile(null);
    setParsingConnectedRepo(null);
  };

  const chooseConnectedRepo = (repo: GitHubRepo) => {
    setError("");
    const uploadId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    setParsingUploadId(uploadId);
    setParsingConnectedRepo(repo);
    setParsingFile(null);
    setParsingRepoUrl("");
  };

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    void chooseFile(event.target.files?.[0]);
    event.target.value = "";
  };

  const openProject = (projectId: string) => {
    navigate("home", { state: { projectId } });
  };

  const openSecurity = (projectId: string) => {
    navigate("security", { state: { projectId } });
  };

  const canManage = (project: DeveloperProject) =>
    project.is_manager === true || project.owner_email === user?.email;

  const changeStatus = async (project: DeveloperProject, status: ProjectStatus) => {
    try {
      await updateProjectStatus(project.project_id, token, status);
      setProjects((current) =>
        (current ?? []).map((item) =>
          item.project_id === project.project_id ? { ...item, status } : item,
        ),
      );
      toastSuccess(`Marked "${project.project}" as ${status.replace("_", " ").toUpperCase()}.`);
    } catch {
      toastError("Could not update the project status.");
    }
  };

  const STATUS_LABELS: Record<ProjectStatus, string> = {
    new: "NEW",
    in_progress: "IN PROGRESS",
    completed: "COMPLETED",
  };

  const STATUS_STYLES: Record<ProjectStatus, string> = {
    new: "text-[#5b8dd9]",
    in_progress: "text-[#c08532]",
    completed: "text-[#1f8a65]",
  };

  const removeProject = async (project: DeveloperProject) => {
    if (!window.confirm(`Delete "${project.project}" permanently? Everyone loses access to it.`)) {
      return;
    }
    setDeletingId(project.project_id);
    try {
      await deleteProject(project.project_id, token);
      setProjects((current) =>
        (current ?? []).filter((item) => item.project_id !== project.project_id),
      );
      toastSuccess(`Deleted "${project.project}".`);
    } catch (error) {
      const detail = (error as { response?: { data?: { detail?: string } } }).response?.data
        ?.detail;
      toastError(detail || "Could not delete the project.");
    } finally {
      setDeletingId("");
    }
  };

  const revokeAccess = async (project: DeveloperProject) => {
    if (
      !window.confirm(
        `Revoke your access to "${project.project}"? You will no longer see it in your account.`,
      )
    ) {
      return;
    }
    try {
      await revokeProjectMembership(project.project_id, token);
      setProjects((current) =>
        (current ?? []).filter((item) => item.project_id !== project.project_id),
      );
      toastSuccess(`Access revoked. You left "${project.project}".`);
    } catch (error) {
      const detail = (error as { response?: { data?: { detail?: string } } }).response?.data
        ?.detail;
      toastError(detail || "Could not revoke your access.");
    }
  };

  const myProjects = (projects ?? []).filter(
    (project) => project.owner_email === user?.email,
  );
  const collaborations = (projects ?? []).filter(
    (project) => project.owner_email !== user?.email,
  );

  const renderProjectGrid = (list: DeveloperProject[], emptyState: ReactNode) => (
    <div className="mt-6 flex-1">
      {listError && <p className="ca-mono text-xs text-[var(--ca-error)]">{listError}</p>}
      {!projects && !listError && (
        <div className="ca-mono text-xs text-[var(--ca-muted)]">
          <InlineLoader label="Loading your projects…" />
        </div>
      )}
      {projects && list.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-4 py-24">{emptyState}</div>
      )}
      {list.length > 0 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {list.map((project) => (
            <article
              key={project.project_id}
              className="ca-card flex cursor-pointer flex-col gap-4 p-5 transition-colors hover:border-[var(--ca-hairline-strong)]"
              onClick={() => openProject(project.project_id)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="ca-title m-0 truncate text-[15px] text-[var(--ca-ink)]">
                    {project.project}
                  </h3>
                  <p className="ca-mono-label mt-1 truncate">
                    {project.source === "github" ? "GITHUB" : "ZIP"} · {project.owner_email}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {canManage(project) ? (
                    <select
                      value={project.status ?? "new"}
                      onChange={(event) =>
                        void changeStatus(project, event.target.value as ProjectStatus)
                      }
                      onClick={(event) => event.stopPropagation()}
                      className={`ca-mono-label shrink-0 cursor-pointer rounded-[9999px] border border-[var(--ca-hairline)] bg-[var(--ca-surface-strong)] px-2.5 py-1 outline-none ${STATUS_STYLES[project.status ?? "new"]}`}
                      title="Project status"
                    >
                      {(Object.keys(STATUS_LABELS) as ProjectStatus[]).map((value) => (
                        <option key={value} value={value}>
                          {STATUS_LABELS[value]}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span
                      className={`ca-mono-label shrink-0 rounded-[9999px] border border-[var(--ca-hairline)] bg-[var(--ca-surface-strong)] px-2.5 py-1 ${STATUS_STYLES[project.status ?? "new"]}`}
                    >
                      {STATUS_LABELS[project.status ?? "new"]}
                    </span>
                  )}
                  {canManage(project) && (
                    <button
                      className="ca-mono text-[var(--ca-error)] transition-opacity hover:opacity-70 disabled:opacity-40"
                      disabled={deletingId === project.project_id}
                      title="Delete project permanently"
                      onClick={(event) => {
                        event.stopPropagation();
                        void removeProject(project);
                      }}
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className={`ca-badge !h-[18px] !px-2 text-[9px] ${project.source === "github" ? "bg-[color-mix(in_srgb,var(--ca-primary)_14%,var(--ca-surface-card))] text-[var(--ca-primary)]" : "bg-[color-mix(in_srgb,var(--ca-success)_14%,var(--ca-surface-card))] text-[var(--ca-success)]"}`}>
                  {project.source === "github" ? "GITHUB" : "ZIP"}
                </span>
                {project.is_manager && (
                  <span className="ca-badge !h-[18px] !px-2 text-[9px] bg-[color-mix(in_srgb,var(--ca-primary)_14%,var(--ca-surface-card))] text-[var(--ca-primary)]">
                    MANAGER
                  </span>
                )}
                {(["metadata", "graph", "source", "download"] as const).map((flag) => (
                  <span
                    key={flag}
                    className={`ca-badge !h-[18px] !px-2 text-[9px] ${project.access[flag] ? "bg-[var(--ca-surface-strong)] text-[var(--ca-body)]" : "bg-transparent text-[var(--ca-muted-soft)] opacity-60"}`}
                  >
                    {flag.toUpperCase()} {project.access[flag] ? "ON" : "OFF"}
                  </span>
                ))}
              </div>
              <div className="mt-auto flex gap-2">
                {canManage(project) && (
                  <button
                    className="ca-btn-secondary h-9 flex-1 !text-[12px]"
                    onClick={(event) => {
                      event.stopPropagation();
                      openSecurity(project.project_id);
                    }}
                  >
                    Security
                  </button>
                )}
                {project.owner_email !== user?.email && (
                  <button
                    className="h-9 flex-1 rounded-[8px] border border-[var(--ca-error)]/40 text-[12px] font-medium text-[var(--ca-error)] transition-colors hover:border-[var(--ca-error)]"
                    onClick={(event) => {
                      event.stopPropagation();
                      void revokeAccess(project);
                    }}
                    title="Revoke the access this project gave you"
                  >
                    Revoke access
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <main className="min-h-screen bg-[var(--ca-canvas)]">
      {!(parsingFile || parsingRepoUrl || parsingConnectedRepo) && (
        <TopBar
        theme={theme}
        onToggleTheme={onToggleTheme}
        onOpenProfile={onOpenProfile}
        onOpenSettings={onOpenSettings}
        onNewProject={() => setTab("add")}
        onLogout={onLogout}
        user={user}
        tabs={[
          {
            id: "projects",
            label: `Projects${projects ? ` (${myProjects.length})` : ""}`,
            active: tab === "projects",
            onClick: () => setTab("projects"),
          },
          {
            id: "collab",
            label: `Collaboration${projects ? ` (${collaborations.length})` : ""}`,
            active: tab === "collab",
            onClick: () => setTab("collab"),
          },
          {
            id: "add",
            label: "+ New project",
            active: tab === "add",
            onClick: () => setTab("add"),
          },
        ]}
      />
      )}

      {parsingFile || parsingRepoUrl || parsingConnectedRepo ? (
        <ParsingScreen
          file={parsingFile ?? undefined}
          repoUrl={parsingRepoUrl || undefined}
          connectedRepo={parsingConnectedRepo ?? undefined}
          authToken={parsingConnectedRepo ? token : undefined}
          uploadId={parsingUploadId}
          onComplete={handleParseComplete}
          onError={handleParseError}
          onCancel={handleParseCancel}
        />
      ) : (
        <div className="mx-auto flex min-h-[calc(100vh-72px)] w-full max-w-[1180px] flex-col px-[30px] pb-[60px] pt-10 max-[850px]:px-[18px]">
          {tab === "projects" ? (
            renderProjectGrid(myProjects, (
              <EmptyState
                icon={FolderOpen}
                title="No projects yet"
                description="Upload a ZIP or import a GitHub repository to build your first architecture map."
                actions={
                  <button className="ca-btn-primary" onClick={() => setTab("add")}>
                    Add your first project
                  </button>
                }
              />
            ))
          ) : tab === "collab" ? (
            renderProjectGrid(collaborations, (
              <EmptyState
                icon={Users}
                title="No collaboration projects"
                description="When someone shares a project with you — as a GitHub collaborator, manager, or through an access grant — it appears here."
              />
            ))
          ) : (
            <div className="flex flex-1 flex-col justify-center">
              <LandingView
                dragging={dragging}
                error={error}
                githubUrl={githubUrl}
                githubToken={token}
                onBrowse={() => inputRef.current?.click()}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(event) => {
                  event.preventDefault();
                  setDragging(false);
                  void chooseFile(event.dataTransfer.files[0]);
                }}
                onGitHubUrlChange={setGithubUrl}
                onGitHubImport={chooseGithubUrl}
                onGitHubRepoImport={chooseConnectedRepo}
              />
            </div>
          )}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept=".zip,application/zip"
        hidden
        onChange={onFileChange}
      />
    </main>
  );
}

export default Projects;