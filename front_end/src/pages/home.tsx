import { useEffect, useState } from "react";
import api from "../services/api";

function Home() {
    const [message, setMessage] = useState("Connecting to backend...");

    useEffect(() => {
        api.get("/api/status")
            .then((response) => {
                setMessage(response.data.message);
            })
            .catch(() => {
                setMessage("Backend Not Connected ❌");
            });
    }, []);

    return (
        <div
            style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                flexDirection: "column",
                height: "100vh",
                gap: "20px",
            }}
        >
            <h1>CodeAtlas</h1>

            <p>Interactive Code Visualizer</p>

            <button>Upload Project</button>

            <h3>{message}</h3>
        </div>
    );
}

export default Home;