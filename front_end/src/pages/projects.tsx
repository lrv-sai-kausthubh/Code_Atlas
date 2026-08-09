import { useCallback, useEffect, useRef, useState } from "react";
import type { ChangeEvent, ReactNode } from "react";
import { Trash2 } from "lucide-react";
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
    new: "STARTED NEWLY",
    in_progress: "IN PROGRESS",
    completed: "COMPLETED",
  };

  const STATUS_STYLES: Record<ProjectStatus, string> = {
    new: "border-[#7aa2f7]/60 text-[#7aa2f7]",
    in_progress: "border-[#f2b84b]/60 text-[#f2b84b]",
    completed: "border-[#64d5c4]/60 text-[#64d5c4]",
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
      {listError && <p className="font-dm text-xs text-[#f17c71]">{listError}</p>}
      {!projects && !listError && (
        <p className="font-dm text-xs text-[#79817e]">
          <InlineLoader label="Loading your projects…" />
        </p>
      )}
      {projects && list.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-4 py-24">{emptyState}</div>
      )}
      {list.length > 0 && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {list.map((project) => (
            <article
              key={project.project_id}
              className="flex flex-col gap-3 border border-[#2a3330] bg-[#171a1a] p-4 transition-colors hover:border-[#64d5c4]/60 light:border-[#d3ddd6] light:bg-[#f6f8f5] cursor-pointer"
              onClick={() => openProject(project.project_id)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="m-0 truncate font-dm text-[13px] text-[#eef0eb] light:text-[#202824]">
                    {project.project}
                  </h3>
                  <p className="mt-1 truncate font-dm text-[10px] text-[#79817e] light:text-[#61716a]">
                    {project.source === "github" ? "GITHUB" : "ZIP"} · {project.owner_email}
                  </p>
                </div>
                <span
                  className={`shrink-0 border px-1.5 py-0.5 font-dm text-[9px] tracking-[.08em] ${project.source === "github" ? "border-[#f2b84b]/60 text-[#f2b84b]" : "border-[#64d5c4]/60 text-[#64d5c4]"}`}
                >
                  {project.source === "github" ? "GH" : "ZIP"}
                </span>
                {project.is_manager && (
                  <span className="shrink-0 border border-[#f2b84b]/60 px-1.5 py-0.5 font-dm text-[9px] tracking-[.08em] text-[#f2b84b]">
                    MANAGER
                  </span>
                )}
                {canManage(project) ? (
                  <select
                    value={project.status ?? "new"}
                    onChange={(event) =>
                      void changeStatus(project, event.target.value as ProjectStatus)
                    }
                    onClick={(event) => event.stopPropagation()}
                    className={`shrink-0 border bg-[#171a1a] px-1.5 py-0.5 font-dm text-[9px] tracking-[.08em] outline-none ${STATUS_STYLES[project.status ?? "new"]} light:bg-[#f6f8f5]`}
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
                    className={`shrink-0 border px-1.5 py-0.5 font-dm text-[9px] tracking-[.08em] ${STATUS_STYLES[project.status ?? "new"]}`}
                  >
                    {STATUS_LABELS[project.status ?? "new"]}
                  </span>
                )}
                {canManage(project) && (
                  <button
                    className="font-dm text-[9px] text-[#f17c71] transition-colors hover:text-[#f17c71] disabled:opacity-40"
                    disabled={deletingId === project.project_id}
                    title="Delete project permanently"
                    onClick={(event) => {
                      event.stopPropagation();
                      void removeProject(project);
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-1">
                {(["metadata", "graph", "source", "download"] as const).map((flag) => (
                  <span
                    key={flag}
                    className={`border px-1.5 py-0.5 font-dm text-[9px] ${project.access[flag] ? "border-[#64d5c4]/70 text-[#64d5c4]" : "border-[#39413e] text-[#79817e] opacity-60 light:border-[#ccd8d1]"}`}
                  >
                    {flag.toUpperCase()} {project.access[flag] ? "ON" : "OFF"}
                  </span>
                ))}
              </div>
              <div className="mt-auto flex gap-2">
                <button
                  className="flex-1 border border-[#39413e] py-2 font-dm text-[10px] tracking-[.08em] text-[#79817e] transition-colors hover:border-[#f2b84b] hover:text-[#f2b84b] light:border-[#c2cfc7] light:text-[#5c6b64]"
                  onClick={(event) => {
                    event.stopPropagation();
                    openProject(project.project_id);
                  }}
                >
                  OPEN MAP
                </button>
                {canManage(project) && (
                  <button
                    className="flex-1 border border-[#f2b84b]/50 py-2 font-dm text-[10px] tracking-[.08em] text-[#f2b84b] transition-colors hover:border-[#f2b84b]"
                    onClick={(event) => {
                      event.stopPropagation();
                      openSecurity(project.project_id);
                    }}
                  >
                    SECURITY
                  </button>
                )}
                {project.owner_email !== user?.email && (
                  <button
                    className="flex-1 border border-[#6b2f2a] py-2 font-dm text-[10px] tracking-[.08em] text-[#e58a80] transition-colors hover:border-[#f17c71] hover:text-[#f17c71]"
                    onClick={(event) => {
                      event.stopPropagation();
                      void revokeAccess(project);
                    }}
                    title="Revoke the access this project gave you"
                  >
                    REVOKE ACCESS
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
    <main className="min-h-screen bg-[radial-gradient(circle_at_72%_20%,#1a2424_0,transparent_32%),#101112] light:bg-[radial-gradient(circle_at_72%_20%,#dbeae5_0,transparent_34%),#eef1ed]">
      <TopBar
        theme={theme}
        onToggleTheme={onToggleTheme}
        onOpenProfile={onOpenProfile}
        onOpenSettings={onOpenSettings}
        onNewProject={() => setTab("add")}
        onLogout={onLogout}
        user={user}
      />

      {parsingFile || parsingRepoUrl || parsingConnectedRepo ? (
        <ParsingScreen
          file={parsingFile ?? undefined}
          repoUrl={parsingRepoUrl || undefined}
          connectedRepo={parsingConnectedRepo ?? undefined}
          authToken={parsingConnectedRepo ? token : undefined}
          uploadId={parsingUploadId}
          onComplete={(nextGraph: ProjectGraph) => {
            navigate("home", { state: { graph: nextGraph } });
            void loadProjects();
          }}
          onError={(message) => {
            setError(message);
            setParsingFile(null);
            setParsingRepoUrl("");
            setParsingConnectedRepo(null);
          }}
          onCancel={() => {
            setParsingFile(null);
            setParsingRepoUrl("");
            setParsingConnectedRepo(null);
            setError("Upload cancelled.");
          }}
        />
      ) : (
        <div className="mx-auto flex min-h-[calc(100vh-72px)] w-full max-w-[1180px] flex-col px-[30px] pb-[60px] pt-8 max-[850px]:px-[18px]">
          <div className="flex items-center gap-2 border-b border-[#2a3330] light:border-[#d3ddd6]">
            <button
              className={`border-0 border-b-2 bg-transparent px-4 py-3 font-dm text-[11px] tracking-[.1em] transition-colors ${tab === "projects" ? "border-[#f2b84b] text-[#eef0eb] light:text-[#202824]" : "border-transparent text-[#79817e] hover:text-[#f2b84b]"}`}
              onClick={() => setTab("projects")}
            >
              MY PROJECTS
              {projects ? ` (${myProjects.length})` : ""}
            </button>
            <button
              className={`border-0 border-b-2 bg-transparent px-4 py-3 font-dm text-[11px] tracking-[.1em] transition-colors ${tab === "collab" ? "border-[#64d5c4] text-[#eef0eb] light:text-[#202824]" : "border-transparent text-[#79817e] hover:text-[#64d5c4]"}`}
              onClick={() => setTab("collab")}
            >
              COLLABORATION
              {projects ? ` (${collaborations.length})` : ""}
            </button>
            <button
              className={`border-0 border-b-2 bg-transparent px-4 py-3 font-dm text-[11px] tracking-[.1em] transition-colors ${tab === "add" ? "border-[#64d5c4] text-[#eef0eb] light:text-[#202824]" : "border-transparent text-[#79817e] hover:text-[#64d5c4]"}`}
              onClick={() => setTab("add")}
            >
              + ADD PROJECT
            </button>
          </div>

          {tab === "projects" ? (
            renderProjectGrid(myProjects, (
              <>
                <p className="font-dm text-[13px] text-[#79817e]">
                  No projects yet. Upload a ZIP or import a GitHub repository to build your first architecture map.
                </p>
                <button
                  className="border border-[#64d5c4] bg-[#14231f] px-6 py-3 font-dm text-[12px] tracking-[.08em] text-[#64d5c4] transition-colors hover:bg-[#1d3a33] light:border-[#398f83] light:bg-[#e3ece7] light:text-[#398f83]"
                  onClick={() => setTab("add")}
                >
                  + ADD YOUR FIRST PROJECT
                </button>
              </>
            ))
          ) : tab === "collab" ? (
            renderProjectGrid(collaborations, (
              <p className="font-dm text-[13px] text-[#79817e]">
                No collaboration projects yet. When someone shares a project with you — as a GitHub
                collaborator, manager, or through an access grant — it appears here.
              </p>
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
