import { useCallback, useEffect, useRef, useState } from "react";
import type { XYPosition } from "@xyflow/react";
import TopBar from "../components/workspace/topbar";
import WorkspaceLayout from "../components/workspace/workspace-layout";
import { AtlasLoader } from "../components/premium-loader";
import { useNavigation } from "../services/navigation";
import { createAccessRequest, getProjectGraph } from "../services/api";
import { toastError, toastSuccess } from "../services/toast";
import { useLiveEvents } from "../hooks/useLiveEvents";
import type { ProjectGraph, ProjectNode } from "../types/project";
import type { CurrentUser } from "../services/api";

type WorkspaceProps = {
  onLogout: () => void;
  theme: "dark" | "light";
  onToggleTheme: () => void;
  onOpenProfile: () => void;
  onOpenSettings: () => void;
  user?: CurrentUser | null;
};

type WorkspaceNavState = {
  graph?: ProjectGraph;
  projectId?: string;
};

function Workspace({
  onLogout,
  theme,
  onToggleTheme,
  onOpenProfile,
  onOpenSettings,
  user,
}: WorkspaceProps) {
  const { navigate, routeState } = useNavigation();
  const navGraph = (routeState as WorkspaceNavState | null)?.graph ?? null;
  const navProjectId = (routeState as WorkspaceNavState | null)?.projectId ?? "";
  const [graph, setGraph] = useState<ProjectGraph | null>(() => {
    if (navGraph) return navGraph;
    try {
      const raw = localStorage.getItem("codeatlas-last-graph");
      return raw ? (JSON.parse(raw) as ProjectGraph) : null;
    } catch {
      return null;
    }
  });
  const [projectId, setProjectId] = useState<string>(() => {
    if (navGraph?.project_id) return navGraph.project_id;
    if (navProjectId) return navProjectId;
    try {
      const raw = localStorage.getItem("codeatlas-last-graph");
      return raw ? ((JSON.parse(raw) as ProjectGraph).project_id ?? "") : "";
    } catch {
      return "";
    }
  });
  const [selected, setSelected] = useState<ProjectNode | null>(() => {
    if (navGraph?.nodes?.[0]) return navGraph.nodes[0];
    try {
      const raw = localStorage.getItem("codeatlas-last-graph");
      return raw ? ((JSON.parse(raw) as ProjectGraph).nodes[0] ?? null) : null;
    } catch {
      return null;
    }
  });
  const [positionOffsets, setPositionOffsets] = useState<Map<string, XYPosition>>(() => {
    if (navGraph?.project_id) return new Map();
    try {
      const raw = localStorage.getItem("codeatlas-last-graph");
      if (!raw) return new Map();
      const storedProjectId = (JSON.parse(raw) as ProjectGraph).project_id ?? "";
      if (!storedProjectId) return new Map();
      const stored = localStorage.getItem(`codeatlas-offsets-${storedProjectId}`);
      if (!stored) return new Map();
      return new Map(
        JSON.parse(stored) as [string, { x: number; y: number }][],
      );
    } catch {
      return new Map();
    }
  });
  const [error, setError] = useState("");
  const [needLogin, setNeedLogin] = useState(false);
  const [canRequestAccess, setCanRequestAccess] = useState(false);
  const [requestReason, setRequestReason] = useState("");
  const [requestBusy, setRequestBusy] = useState(false);
  const [requestSent, setRequestSent] = useState(false);
  const token = localStorage.getItem("codeatlas-token") ?? "";

  const loadById = useCallback(async (targetId: string) => {
    try {
      const response = await getProjectGraph(targetId, token);
      setGraph(response.data);
      setProjectId(response.data.project_id ?? targetId);
      setSelected(response.data.nodes[0] ?? null);
      setPositionOffsets(new Map());
      setCanRequestAccess(false);
      setRequestSent(false);
      try {
        localStorage.setItem("codeatlas-last-graph", JSON.stringify(response.data));
      } catch {
        // storage full; keep in-memory only
      }
    } catch (loadError) {
      const status = (loadError as { response?: { status?: number } }).response?.status;
      if (status === 401) {
        sessionStorage.setItem("codeatlas-pending-project", targetId);
        setNeedLogin(true);
        return;
      }
      if (status === 403) {
        setError(
          "You don't have access to this project yet. Send a collaboration request and the owner will review it.",
        );
        setCanRequestAccess(true);
        return;
      }
      setError("You don't have access to that project, or it no longer exists.");
      setCanRequestAccess(false);
    }
  }, [token]);

  const sendAccessRequest = async () => {
    if (!projectId) return;
    setRequestBusy(true);
    try {
      await createAccessRequest(
        projectId,
        token,
        "",
        requestReason.trim() || "I would like to collaborate on this project.",
      );
      setRequestSent(true);
      toastSuccess("Collaboration request sent. The owner will review it shortly.");
    } catch {
      toastError("Could not send the request.");
    } finally {
      setRequestBusy(false);
    }
  };

  useEffect(() => {
    if (navGraph) return;
    const params = new URLSearchParams(window.location.search);
    const sharedProjectId = params.get("project");
    if (navProjectId) {
      void loadById(navProjectId);
      window.history.replaceState({}, "", window.location.pathname);
    } else if (sharedProjectId) {
      void loadById(sharedProjectId);
      window.history.replaceState({}, "", window.location.pathname);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const liveRefreshRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useLiveEvents((event) => {
    if (event.project_id !== projectId || !projectId) return;
    if (event.type === "project.deleted") {
      setError("This project was deleted by its owner.");
      setCanRequestAccess(false);
      return;
    }
    const relevant =
      event.type.startsWith("policy.") || event.type === "access.request";
    if (!relevant) return;
    if (liveRefreshRef.current) return;
    liveRefreshRef.current = setTimeout(() => {
      liveRefreshRef.current = null;
      void loadById(projectId);
    }, 300);
  });

  const handleSelect = useCallback((node: ProjectNode) => {
    setSelected(node);
  }, []);

  const handleMoveNodes = useCallback((next: Map<string, XYPosition>) => {
    setPositionOffsets(next);
    try {
      const raw = localStorage.getItem("codeatlas-last-graph");
      if (!raw) return;
      const storedProjectId = (JSON.parse(raw) as ProjectGraph).project_id ?? "";
      if (!storedProjectId) return;
      localStorage.setItem(
        `codeatlas-offsets-${storedProjectId}`,
        JSON.stringify([...next.entries()]),
      );
    } catch {
      // storage full; keep in-memory only
    }
  }, []);

  if (needLogin) {
    return (
      <main className="min-h-screen bg-[var(--ca-canvas)]">
        <TopBar
          theme={theme}
          onToggleTheme={onToggleTheme}
          onOpenProfile={onOpenProfile}
          onOpenSettings={onOpenSettings}
          onNewProject={() => navigate("projects")}
          onLogout={onLogout}
          user={user}
        />
        <div className="flex h-[calc(100vh-72px)] flex-col items-center justify-center gap-5">
          <p className="max-w-[420px] text-center text-[14px] leading-relaxed text-[var(--ca-body)]">
            Sign in to view this project. You will be brought straight back here
            after logging in.
          </p>
          <button
            className="ca-btn-primary"
            onClick={() => navigate("login")}
          >
            Sign in
          </button>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-[var(--ca-canvas)]">
        <TopBar
          theme={theme}
          onToggleTheme={onToggleTheme}
          onOpenProfile={onOpenProfile}
          onOpenSettings={onOpenSettings}
          onNewProject={() => navigate("projects")}
          onLogout={onLogout}
          user={user}
        />
        <div className="flex h-[calc(100vh-72px)] flex-col items-center justify-center gap-4">
          <p className="max-w-[520px] text-center text-[14px] text-[var(--ca-error)]">{error}</p>
          {canRequestAccess && !requestSent && (
            <div className="flex w-full max-w-[460px] flex-col gap-2">
              <textarea
                value={requestReason}
                onChange={(event) => setRequestReason(event.target.value)}
                placeholder="Why do you need access? (optional)"
                rows={2}
                className="ca-input h-auto resize-none p-3 font-mono text-[12px]"
              />
              <button
                className="ca-btn-primary"
                disabled={requestBusy}
                onClick={() => void sendAccessRequest()}
              >
                {requestBusy ? "Sending…" : "Request collaboration access"}
              </button>
            </div>
          )}
          {canRequestAccess && requestSent && (
            <p className="max-w-[460px] text-center text-[12px] text-[var(--ca-success)]">
              Request sent. When the owner approves it, this project will appear in your
              collaboration tab.
            </p>
          )}
        </div>
      </main>
    );
  }

  if (!graph) {
    return (
      <main className="flex min-h-screen flex-col bg-[var(--ca-canvas)]">
        <TopBar
          theme={theme}
          onToggleTheme={onToggleTheme}
          onOpenProfile={onOpenProfile}
          onOpenSettings={onOpenSettings}
          onNewProject={() => navigate("projects")}
          onLogout={onLogout}
          user={user}
        />
        <div className="flex flex-1 flex-col items-center justify-center">
          <div className="flex w-full flex-1 flex-col">
            <AtlasLoader label="Loading project graph" />
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[var(--ca-canvas)]">
      <TopBar
        theme={theme}
        onToggleTheme={onToggleTheme}
        onOpenProfile={onOpenProfile}
        onOpenSettings={onOpenSettings}
        onNewProject={() => navigate("projects")}
        onLogout={onLogout}
        user={user}
      />
      <WorkspaceLayout
        graph={graph}
        projectId={projectId}
        selected={selected}
        token={token}
        onSelect={handleSelect}
        positionOffsets={positionOffsets}
        onMoveNodes={handleMoveNodes}
        onBack={() => navigate("projects")}
      />
      {graph.files === 0 && (
        <div className="pointer-events-none absolute inset-x-0 top-[72px] z-10 text-center">
          <span className="ca-mono-label text-[var(--ca-primary)]">
            This project contains no analyzable files.
          </span>
        </div>
      )}
    </main>
  );
}

export default Workspace;
