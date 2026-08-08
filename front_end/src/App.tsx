import { useState } from "react";
import Home from "./pages/home";
import Landing from "./pages/landing";
import Login from "./pages/login";

type Route = "landing" | "login" | "home";

function App() {
    const [route, setRoute] = useState<Route>("landing");

    if (route === "login") {
        return <Login onLogin={() => setRoute("home")} onBack={() => setRoute("landing")} />;
    }

    if (route === "home") {
        return <Home />;
    }

    return <Landing onGetStarted={() => setRoute("login")} />;
}

export default App;
