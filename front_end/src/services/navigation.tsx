import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

export type Route =
    | "landing"
    | "login"
    | "home"
    | "projects"
    | "security"
    | "admin"
    | "profile"
    | "settings"
    | "privacy"
    | "terms";

type NavigationValue = {
    route: Route;
    navigate: (next: Route, options?: { replace?: boolean; state?: unknown }) => void;
    goBack: () => void;
    routeState: unknown;
};

const NavigationContext = createContext<NavigationValue | null>(null);

export function routeFromPath(path: string): Route {
    if (path === "/login") return "login";
    if (path === "/workspace") return "home";
    if (path === "/projects") return "projects";
    if (path === "/security") return "security";
    if (path === "/admin") return "admin";
    if (path === "/profile") return "profile";
    if (path === "/settings") return "settings";
    if (path === "/privacy") return "privacy";
    if (path === "/terms") return "terms";
    return "landing";
}

export function pathFromRoute(route: Route): string {
    if (route === "login") return "/login";
    if (route === "home") return "/workspace";
    if (route === "projects") return "/projects";
    if (route === "security") return "/security";
    if (route === "admin") return "/admin";
    if (route === "profile") return "/profile";
    if (route === "settings") return "/settings";
    if (route === "privacy") return "/privacy";
    if (route === "terms") return "/terms";
    return "/";
}

export function NavigationProvider({ children }: { children: ReactNode }) {
    const [route, setRoute] = useState<Route>(() => routeFromPath(window.location.pathname));
    const [routeState, setRouteState] = useState<unknown>(null);
    const routeRef = useRef(route);
    const stackRef = useRef<Route[]>([]);

    const apply = useCallback((next: Route, mode: "push" | "replace", state?: unknown) => {
        routeRef.current = next;
        setRoute(next);
        setRouteState(state ?? null);
        const path = pathFromRoute(next);
        if (window.location.pathname !== path) {
            if (mode === "replace") {
                window.history.replaceState({}, "", path);
            } else {
                window.history.pushState({}, "", path);
            }
        }
    }, []);

    const navigate = useCallback(
        (next: Route, options?: { replace?: boolean; state?: unknown }) => {
            if (options?.replace) {
                apply(next, "replace", options.state);
                return;
            }
            stackRef.current.push(routeRef.current);
            apply(next, "push", options?.state);
        },
        [apply],
    );

    const goBack = useCallback(() => {
        const previous = stackRef.current.pop();
        const current = routeRef.current;
        const fallback: Route = current === "home" ? "projects" : current === "login" ? "landing" : "projects";
        apply(previous ?? fallback, "push", null);
    }, [apply]);

    useEffect(() => {
        const onPop = () => {
            const next = routeFromPath(window.location.pathname);
            routeRef.current = next;
            setRoute(next);
            setRouteState(null);
        };
        window.addEventListener("popstate", onPop);
        return () => window.removeEventListener("popstate", onPop);
    }, []);

    const value: NavigationValue = { route, navigate, goBack, routeState };
    return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>;
}

export function useNavigation(): NavigationValue {
    const value = useContext(NavigationContext);
    if (!value) throw new Error("useNavigation must be used within NavigationProvider");
    return value;
}
