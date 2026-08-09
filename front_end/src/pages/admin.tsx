import TopBar from "../components/workspace/topbar";
import AdminCenter from "../components/security/admin-center";
import { useNavigation } from "../services/navigation";
import type { CurrentUser } from "../services/api";

type AdminProps = {
  onLogout: () => void;
  theme: "dark" | "light";
  onToggleTheme: () => void;
  onOpenProfile: () => void;
  onOpenSettings: () => void;
  user?: CurrentUser | null;
};

function Admin({
  onLogout,
  theme,
  onToggleTheme,
  onOpenProfile,
  onOpenSettings,
  user,
}: AdminProps) {
  const { navigate } = useNavigation();
  const token = localStorage.getItem("codeatlas-token") ?? "";

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_72%_20%,#1a2424_0,transparent_32%),#101112] light:bg-[radial-gradient(circle_at_72%_20%,#dbeae5_0,transparent_34%),#eef1ed]">
      <TopBar
        theme={theme}
        onToggleTheme={onToggleTheme}
        onOpenProfile={onOpenProfile}
        onOpenSettings={onOpenSettings}
        onNewProject={() => navigate("projects")}
        onLogout={onLogout}
        user={user}
      />
      {user?.role === "super_admin" ? (
        <AdminCenter token={token} onBack={() => navigate("projects")} />
      ) : (
        <div className="flex h-[calc(100vh-72px)] flex-col items-center justify-center gap-4">
          <p className="font-dm text-sm text-[#f17c71]">
            The Admin Center is restricted to platform super admins.
          </p>
          <button
            className="border border-[#39413e] px-4 py-2 font-dm text-[11px] tracking-[.08em] text-[#79817e] hover:border-[#f2b84b] hover:text-[#f2b84b]"
            onClick={() => navigate("projects")}
          >
            BACK TO PROJECTS
          </button>
        </div>
      )}
    </main>
  );
}

export default Admin;
