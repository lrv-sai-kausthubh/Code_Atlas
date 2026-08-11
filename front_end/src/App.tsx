import { useCallback, useEffect, useRef, useState } from "react";
import { Toaster } from "sonner";
import Landing from "./pages/landing";
import Login from "./pages/login";
import Profile from "./pages/profile";
import Settings from "./pages/settings";
import Projects from "./pages/projects";
import Workspace from "./pages/workspace";
import Security from "./pages/security";
import Admin from "./pages/admin";
import { getMe, logout } from "./services/api";
import type { CurrentUser } from "./services/api";
import { toastState } from "./services/toast";
import { NavigationProvider, useNavigation } from "./services/navigation";
import { AtlasLoader } from "./components/premium-loader";

const TOKEN_KEY = "codeatlas-token";

function AppInner() {
  const { route, navigate } = useNavigation();
  const [token, setToken] = useState<string>(
    () => localStorage.getItem(TOKEN_KEY) ?? "",
  );
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [checked, setChecked] = useState(false);
  const reminderShown = useRef<string | null>(null);
  const [theme, setTheme] = useState<"dark" | "light">(
    () =>
      (localStorage.getItem("codeatlas-theme") as "dark" | "light") || "light",
  );

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("codeatlas-theme", theme);
  }, [theme]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oauthToken = params.get("token");
    if (oauthToken) {
      localStorage.setItem(TOKEN_KEY, oauthToken);
      setToken(oauthToken);
      window.history.replaceState({}, "", window.location.pathname);
    }
    const sharedProject = params.get("project");
    if (sharedProject) {
      sessionStorage.setItem("codeatlas-pending-project", sharedProject);
    }
  }, []);

  const openPendingProject = useCallback(() => {
    const pending = sessionStorage.getItem("codeatlas-pending-project");
    if (pending) {
      sessionStorage.removeItem("codeatlas-pending-project");
      navigate("home", { replace: true, state: { projectId: pending } });
      return true;
    }
    return false;
  }, [navigate]);

  useEffect(() => {
    let alive = true;
    const restore = async () => {
      if (!token) {
        setChecked(true);
        if (sessionStorage.getItem("codeatlas-pending-project")) {
          if (route !== "login") navigate("login");
        } else if (route !== "landing" && route !== "login") {
          navigate("landing");
        }
        return;
      }
      try {
        const response = await getMe(token);
        if (alive) {
          setUser(response.data.user);
          setChecked(true);
          if (route === "landing" && !openPendingProject())
            navigate("projects");
        }
      } catch {
        localStorage.removeItem(TOKEN_KEY);
        setToken("");
        setChecked(true);
        if (route !== "landing") navigate("landing");
      }
    };
    void restore();
    return () => {
      alive = false;
    };
  }, [navigate, route, token, openPendingProject]);

  useEffect(() => {
    if (!checked || !user || user.password_set !== false) return;
    const remind = () => {
      toastState("info", {
        id: "password-reminder",
        description:
          "Set a password for your CodeAtlas account so you can sign in even without GitHub.",
        duration: 8000,
        action: {
          label: "SET PASSWORD",
          onClick: () => navigate("profile"),
        },
      });
    };
    // StrictMode and repeated restore() calls replace the `user` object
    // identity, which would otherwise re-fire the toast on every render.
    if (reminderShown.current !== user.email) {
      remind();
      reminderShown.current = user.email;
    }
    const interval = window.setInterval(remind, 5 * 60 * 1000);
    return () => window.clearInterval(interval);
  }, [checked, user, navigate]);

  const handleLogin = useCallback(
    (newToken: string) => {
      localStorage.setItem(TOKEN_KEY, newToken);
      setToken(newToken);
      // A different account must never see the previous account's cached
      // graph or layout in the workspace.
      localStorage.removeItem("codeatlas-last-graph");
      for (let index = localStorage.length - 1; index >= 0; index--) {
        const key = localStorage.key(index);
        if (key && key.startsWith("codeatlas-offsets-")) {
          localStorage.removeItem(key);
        }
      }
      openPendingProject() || navigate("projects", { replace: true });
    },
    [navigate, openPendingProject],
  );

  const handleLogout = useCallback(() => {
    const current = localStorage.getItem(TOKEN_KEY);
    if (current) void logout(current).catch(() => undefined);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem("codeatlas-last-graph");
    for (let index = localStorage.length - 1; index >= 0; index--) {
      const key = localStorage.key(index);
      if (key && key.startsWith("codeatlas-offsets-")) {
        localStorage.removeItem(key);
      }
    }
    sessionStorage.removeItem("codeatlas-pending-project");
    setToken("");
    setUser(null);
    navigate("landing");
  }, [navigate]);

  if (!checked)
    return (
      <main className="flex min-h-screen flex-col">
        <AtlasLoader label="INITIALIZING CODE ATLAS" />
      </main>
    );

  const topBarProps = {
    theme,
    onToggleTheme: () =>
      setTheme((value) => (value === "dark" ? "light" : "dark")),
    onOpenProfile: () => navigate("profile"),
    onOpenSettings: () => navigate("settings"),
    onNewProject: () => navigate("projects"),
    onLogout: handleLogout,
    user,
  };

  if (route === "login") {
    return (
      <>
        <Login onLogin={handleLogin} />
        <Toaster theme="dark" position="bottom-right" richColors closeButton />
      </>
    );
  }

  if (route === "profile") {
    return (
      <>
        {token && user && (
          <Profile
            token={token}
            onUserChange={setUser}
            {...topBarProps}
            user={user}
          />
        )}
        <Toaster theme="dark" position="bottom-right" richColors closeButton />
      </>
    );
  }

  if (route === "settings") {
    return (
      <>
        {token && user && (
          <Settings
            token={token}
            onUserChange={setUser}
            {...topBarProps}
            user={user}
          />
        )}
        <Toaster theme="dark" position="bottom-right" richColors closeButton />
      </>
    );
  }

  if (route === "projects") {
    return (
      <>
        {token && user && <Projects {...topBarProps} />}
        <Toaster theme="dark" position="bottom-right" richColors closeButton />
      </>
    );
  }

  if (route === "home") {
    return (
      <>
        {token && user && <Workspace {...topBarProps} />}
        <Toaster theme="dark" position="bottom-right" richColors closeButton />
      </>
    );
  }

  if (route === "security") {
    return (
      <>
        {token && user && <Security {...topBarProps} />}
        <Toaster theme="dark" position="bottom-right" richColors closeButton />
      </>
    );
  }

  if (route === "admin") {
    return (
      <>
        {token && user && <Admin {...topBarProps} />}
        <Toaster theme="dark" position="bottom-right" richColors closeButton />
      </>
    );
  }

  return (
    <>
      <Landing
        isAuthenticated={Boolean(token)}
        onGetStarted={() => navigate(token ? "projects" : "login")}
      />
      <Toaster theme="dark" position="bottom-right" richColors closeButton />
    </>
  );
}

function App() {
  return (
    <NavigationProvider>
      <AppInner />
    </NavigationProvider>
  );
}

export default App;
