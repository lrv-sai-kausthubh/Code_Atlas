import axios from "axios";
import type { InternalAxiosRequestConfig, AxiosError } from "axios";
import { toastError, toastForbidden, toastNotFound, toastOffline, toastUnauthorized, toastValidation } from "./toast";

type AtlasRequestConfig = InternalAxiosRequestConfig & { silent?: boolean };

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || "http://127.0.0.1:8000",
});

const isSilent = (error: AxiosError) => (error.config as AtlasRequestConfig | undefined)?.silent === true;

api.interceptors.response.use(
    (response) => response,
    (error: AxiosError) => {
        if (isSilent(error)) return Promise.reject(error);
        if (error.code === "ERR_NETWORK") {
            toastOffline("Backend unreachable. Is the API server running?");
        } else if (error.response) {
            const status = error.response.status;
            const detail = (error.response.data as { detail?: string } | undefined)?.detail;
            if (status === 401) toastUnauthorized(detail);
            else if (status === 403) toastForbidden(detail);
            else if (status === 404) toastNotFound(detail);
            else if (status === 422) toastValidation(detail);
            else toastError(detail ?? `Request failed with status ${status}.`);
        }
        return Promise.reject(error);
    }
);

export type UploadProgressHandler = (event: { loaded: number; total?: number }) => void;

export const uploadProject = (file: File, uploadId: string, onUploadProgress?: UploadProgressHandler) => {
    const data = new FormData();
    data.append("file", file);
    data.append("upload_id", uploadId);
    return api.post("/api/upload", data, { onUploadProgress });
};

export const importGithubProject = (repoUrl: string, uploadId: string) => {
    const data = new FormData();
    data.append("repo_url", repoUrl);
    data.append("upload_id", uploadId);
    return api.post("/api/upload/github", data);
};

export const getUploadProgress = (uploadId: string) => api.get(`/api/upload/${encodeURIComponent(uploadId)}/progress`, { silent: true } as AtlasRequestConfig);

export const getUploadResult = (uploadId: string) => api.get(`/api/upload/${encodeURIComponent(uploadId)}/result`, { silent: true } as AtlasRequestConfig);

export const cancelUpload = (uploadId: string) => api.delete(`/api/upload/${encodeURIComponent(uploadId)}`);

export const projectFileUrl = (projectId: string, path: string) =>
    `${api.defaults.baseURL}/api/projects/${encodeURIComponent(projectId)}/file?path=${encodeURIComponent(path)}`;

export const listPreviewableFiles = (projectId: string) => api.get<{ files: string[] }>(`/api/projects/${encodeURIComponent(projectId)}/previewable`);

export type GitHubRepo = {
    full_name: string;
    name: string;
    private: boolean;
    language: string | null;
    description: string | null;
    default_branch: string;
};

export const register = (name: string, email: string, password: string) =>
    api.post<{ token: string; user: { email: string; name: string; github_login?: string | null } }>("/api/auth/register", { name, email, password });

export const login = (email: string, password: string) =>
    api.post<{ token: string; user: { email: string; name: string; github_login?: string | null } }>("/api/auth/login", { email, password });

export const logout = (token: string) => api.post<{ status: string }>("/api/auth/logout", { token });

export const getMe = (token: string) => api.get<{ user: { email: string; name: string; github_login?: string | null } }>("/api/auth/me", { params: { token } });

export const listGitHubRepos = (token: string) => api.get<{ repos: GitHubRepo[] }>("/api/auth/github/repos", { params: { token }, silent: true } as AtlasRequestConfig);

export const importConnectedRepo = (repoUrl: string, uploadId: string, token: string) =>
    api.post<{ upload_id: string; status: string }>("/api/auth/github/import", { repo_url: repoUrl, upload_id: uploadId, token });

export default api;
