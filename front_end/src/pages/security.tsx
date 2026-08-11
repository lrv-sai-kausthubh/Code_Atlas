import { useEffect } from "react";
import TopBar from "../components/workspace/topbar";
import SecurityCenter from "../components/security/security-center";
import { useNavigation } from "../services/navigation";
import type { CurrentUser } from "../services/api";

type SecurityProps = {
  onLogout: () => void;
  theme: "dark" | "light";
  onToggleTheme: () => void;
  onOpenProfile: () => void;
  onOpenSettings: () => void;
  user?: CurrentUser | null;
};

function Security({ onLogout, theme, onToggleTheme, onOpenProfile, onOpenSettings, user }: SecurityProps) {
  const { navigate, routeState } = useNavigation();
  const token = localStorage.getItem("codeatlas-token") ?? "";
  const navProjectId = (routeState as { projectId?: string } | null)?.projectId ?? "";
  const paramProjectId = new URLSearchParams(window.location.search).get("project") ?? "";
  const projectId = navProjectId || paramProjectId;

  // History state is lost on a full page reload; mirror the project into the
  // URL so refreshing the security page keeps the project selected.
  useEffect(() => {
    if (navProjectId && !paramProjectId) {
      window.history.replaceState(
        {},
        "",
        `/security?project=${encodeURIComponent(navProjectId)}`,
      );
    }
  }, [navProjectId, paramProjectId]);

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
      {projectId ? (
        <SecurityCenter
          projectId={projectId}
          token={token}
          onBack={() => navigate("projects")}
        />
      ) : (
        <div className="flex h-[calc(100vh-72px)] items-center justify-center">
          <p className="font-dm text-sm text-[var(--ca-error)]">
            No project selected. Open a project&apos;s security center from your projects list.
          </p>
        </div>
      )}
    </main>
  );
}

export default Security;
