import axios from "axios";

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || "http://127.0.0.1:8000",
});

export const uploadProject = (file: File) => {
    const data = new FormData();
    data.append("file", file);
    return api.post("/api/upload", data);
};

export default api;
