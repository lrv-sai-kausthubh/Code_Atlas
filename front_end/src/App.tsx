import { useCallback, useEffect, useState } from "react";
import { Toaster } from "sonner";
import Home from "./pages/home";
import Landing from "./pages/landing";
import Login from "./pages/login";
import { getMe, logout } from "./services/api";

type Route = "landing" | "login" | "home";

const TOKEN_KEY = "codeatlas-token";

function routeFromPath(path: string): Route {
    if (path === "/login") return "login";
    if (path === "/workspace") return "home";
    return "landing";
}

function pathFromRoute(route: Route): string {
    if (route === "login") return "/login";
    if (route === "home") return "/workspace";
    return "/";
}

function App() {
    const [route, setRoute] = useState<Route>(() =>
        routeFromPath(window.location.pathname),
    );
    const [token, setToken] = useState<string>(() => localStorage.getItem(TOKEN_KEY) ?? "");
    const [checked, setChecked] = useState(false);

    const navigate = useCallback((next: Route) => {
        setRoute(next);
        const path = pathFromRoute(next);
        if (window.location.pathname !== path) {
            window.history.pushState({}, "", path);
        }
    }, []);

    useEffect(() => {
        const onPop = () => setRoute(routeFromPath(window.location.pathname));
        window.addEventListener("popstate", onPop);
        return () => window.removeEventListener("popstate", onPop);
    }, []);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const oauthToken = params.get("token");
        if (oauthToken) {
            localStorage.setItem(TOKEN_KEY, oauthToken);
            setToken(oauthToken);
            window.history.replaceState({}, "", window.location.pathname);
        }
    }, []);

    useEffect(() => {
        let alive = true;
        const restore = async () => {
            if (!token) {
                setChecked(true);
                if (route === "home") navigate("landing");
                return;
            }
            try {
                await getMe(token);
                if (alive) {
                    setChecked(true);
                    if (route !== "home") navigate("home");
                }
            } catch {
                localStorage.removeItem(TOKEN_KEY);
                setToken("");
                setChecked(true);
                if (route === "home") navigate("landing");
            }
        };
        void restore();
        return () => { alive = false; };
    }, [navigate, route, token]);

    const handleLogin = useCallback((newToken: string) => {
        localStorage.setItem(TOKEN_KEY, newToken);
        setToken(newToken);
        navigate("home");
    }, [navigate]);

    const handleLogout = useCallback(() => {
        const current = localStorage.getItem(TOKEN_KEY);
        if (current) void logout(current).catch(() => undefined);
        localStorage.removeItem(TOKEN_KEY);
        setToken("");
        navigate("landing");
    }, [navigate]);

    if (!checked) return null;

    if (route === "login") {
        return <><Login onLogin={handleLogin} /><Toaster theme="dark" position="bottom-right" richColors closeButton /></>;
    }

    if (route === "home") {
        return <><Home onLogout={handleLogout} /><Toaster theme="dark" position="bottom-right" richColors closeButton /></>;
    }

    return <><Landing onGetStarted={() => navigate("login")} /><Toaster theme="dark" position="bottom-right" richColors closeButton /></>;
}

export default App;
