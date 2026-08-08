import axios from "axios";

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || "http://127.0.0.1:8000",
});

export type UploadProgressHandler = (event: { loaded: number; total?: number }) => void;

export const uploadProject = (file: File, uploadId: string, onUploadProgress?: UploadProgressHandler) => {
    const data = new FormData();
    data.append("file", file);
    data.append("upload_id", uploadId);
    return api.post("/api/upload", data, { onUploadProgress });
};

export const getUploadProgress = (uploadId: string) => api.get(`/api/upload/${encodeURIComponent(uploadId)}/progress`);

export const getUploadResult = (uploadId: string) => api.get(`/api/upload/${encodeURIComponent(uploadId)}/result`);

export const cancelUpload = (uploadId: string) => api.delete(`/api/upload/${encodeURIComponent(uploadId)}`);

export const projectFileUrl = (projectId: string, path: string) =>
    `${api.defaults.baseURL}/api/projects/${encodeURIComponent(projectId)}/file?path=${encodeURIComponent(path)}`;

export const listPreviewableFiles = (projectId: string) => api.get<{ files: string[] }>(`/api/projects/${encodeURIComponent(projectId)}/previewable`);

export default api;
