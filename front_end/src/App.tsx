import { useState } from "react";
import { Toaster } from "sonner";
import Home from "./pages/home";
import Landing from "./pages/landing";
import Login from "./pages/login";

type Route = "landing" | "login" | "home";

function App() {
    const [route, setRoute] = useState<Route>("landing");

    if (route === "login") {
        return <><Login onLogin={() => setRoute("home")} onBack={() => setRoute("landing")} /><Toaster theme="dark" position="bottom-right" richColors closeButton /></>;
    }

    if (route === "home") {
        return <><Home /><Toaster theme="dark" position="bottom-right" richColors closeButton /></>;
    }

    return <><Landing onGetStarted={() => setRoute("login")} /><Toaster theme="dark" position="bottom-right" richColors closeButton /></>;
}

export default App;
