import { useCallback, useEffect, useState } from "react";
import { Toaster } from "sonner";
import Home from "./pages/home";
import Landing from "./pages/landing";
import Login from "./pages/login";
import { getMe, logout } from "./services/api";

// add sonner module
type Route = "landing" | "login" | "home";

const TOKEN_KEY = "codeatlas-token";

function App() {
    const [route, setRoute] = useState<Route>("landing");
    const [token, setToken] = useState<string>(() => localStorage.getItem(TOKEN_KEY) ?? "");
    const [checked, setChecked] = useState(false);

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
                return;
            }
            try {
                await getMe(token);
                if (alive) {
                    setRoute("home");
                    setChecked(true);
                }
            } catch {
                localStorage.removeItem(TOKEN_KEY);
                setToken("");
                setChecked(true);
            }
        };
        void restore();
        return () => { alive = false; };
    }, [token]);

    const handleLogin = useCallback((newToken: string) => {
        localStorage.setItem(TOKEN_KEY, newToken);
        setToken(newToken);
        setRoute("home");
    }, []);

    const handleLogout = useCallback(() => {
        const current = localStorage.getItem(TOKEN_KEY);
        if (current) void logout(current).catch(() => undefined);
        localStorage.removeItem(TOKEN_KEY);
        setToken("");
        setRoute("landing");
    }, []);

    if (!checked) return null;

    if (route === "login") {
        return <><Login onLogin={handleLogin} /><Toaster theme="dark" position="bottom-right" richColors closeButton /></>;
    }

    if (route === "home") {
        return <><Home onLogout={handleLogout} /><Toaster theme="dark" position="bottom-right" richColors closeButton /></>;
    }

    return <><Landing onGetStarted={() => setRoute("login")} /><Toaster theme="dark" position="bottom-right" richColors closeButton /></>;
}

export default App;
