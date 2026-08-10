import axios from "axios";
import type { InternalAxiosRequestConfig, AxiosError } from "axios";
import type { ProjectGraph, NodeAccess, RepositoryPolicy, AccessRequest, DeveloperProject, SearchResult, PolicyVersion, Team, SecretFinding, AuditEvent, SecurityEvent, AdminAnalytics, Organization, EffectivePermissions, PreviewGraph, TimeWindow, ProjectStatus } from "../types/project";
import { toastError, toastForbidden, toastNotFound, toastOffline, toastUnauthorized, toastValidation } from "./toast";

type AtlasRequestConfig = InternalAxiosRequestConfig & { silent?: boolean };

export const API_BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

const api = axios.create({
    baseURL: API_BASE_URL,
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

export const uploadProject = (file: File, uploadId: string, onUploadProgress?: UploadProgressHandler, token?: string) => {
    const data = new FormData();
    data.append("file", file);
    data.append("upload_id", uploadId);
    if (token) data.append("token", token);
    return api.post("/api/upload", data, { onUploadProgress });
};

export const importGithubProject = (repoUrl: string, uploadId: string, token?: string) => {
    const data = new FormData();
    data.append("repo_url", repoUrl);
    data.append("upload_id", uploadId);
    if (token) data.append("token", token);
    return api.post("/api/upload/github", data);
};

export const getUploadProgress = (uploadId: string, token: string) => api.get(`/api/upload/${encodeURIComponent(uploadId)}/progress`, { params: { token }, silent: true } as AtlasRequestConfig);

export const getUploadResult = (uploadId: string, token: string) => api.get(`/api/upload/${encodeURIComponent(uploadId)}/result`, { params: { token }, silent: true } as AtlasRequestConfig);

export const cancelUpload = (uploadId: string) => api.delete(`/api/upload/${encodeURIComponent(uploadId)}`);

export const listPreviewableFiles = (projectId: string, token: string) => api.get<{ files: string[] }>(`/api/projects/${encodeURIComponent(projectId)}/previewable`, { params: { token }, silent: true } as AtlasRequestConfig);

export type GitHubRepo = {
    full_name: string;
    name: string;
    private: boolean;
    language: string | null;
    description: string | null;
    default_branch: string;
};

export type CurrentUser = {
    email: string;
    name: string;
    github_login?: string | null;
    avatar_url?: string | null;
    created_at?: number | null;
    role?: string;
    password_set?: boolean;
};

export const register = (name: string, email: string, password: string) =>
    api.post<{ token: string; user: CurrentUser }>("/api/auth/register", { name, email, password }, { silent: true } as AtlasRequestConfig);

export const login = (email: string, password: string) =>
    api.post<{ token: string; user: CurrentUser }>("/api/auth/login", { email, password }, { silent: true } as AtlasRequestConfig);

export const logout = (token: string) => api.post<{ status: string }>("/api/auth/logout", { token });

export const getMe = (token: string) => api.get<{ user: CurrentUser }>("/api/auth/me", { params: { token } });

export const updateProfile = (token: string, name: string, avatarUrl?: string) =>
    api.put<{ user: CurrentUser }>("/api/auth/profile", { name, avatar_url: avatarUrl ?? "" }, { params: { token }, silent: true } as AtlasRequestConfig);

export const changePassword = (token: string, currentPassword: string, newPassword: string) =>
    api.post<{ status: string }>("/api/auth/password", { current_password: currentPassword, new_password: newPassword }, { params: { token }, silent: true } as AtlasRequestConfig);

export const listGitHubRepos = (token: string) => api.get<{ repos: GitHubRepo[] }>("/api/auth/github/repos", { params: { token }, silent: true } as AtlasRequestConfig);

export const importConnectedRepo = (repoUrl: string, uploadId: string, token: string) =>
    api.post<{ upload_id: string; status: string }>("/api/auth/github/import", { repo_url: repoUrl, upload_id: uploadId, token });

// ── RBAC (Phase 1) ─────────────────────────────────────────────────────────

export const getProjectGraph = (projectId: string, token: string) =>
    api.get<ProjectGraph>(`/api/projects/${encodeURIComponent(projectId)}/graph`, { params: { token }, silent: true } as AtlasRequestConfig);

export const getFileContent = (projectId: string, path: string, token: string) =>
    api.get<{ path: string; content: string }>(`/api/projects/${encodeURIComponent(projectId)}/file-content`, { params: { token, path }, silent: true } as AtlasRequestConfig);

export const getProjectFileBlob = (projectId: string, path: string, token: string) =>
    api.get<Blob>(`/api/projects/${encodeURIComponent(projectId)}/file`, { params: { token, path }, responseType: "blob", silent: true } as AtlasRequestConfig);

export const getProjectPolicy = (projectId: string, token: string) =>
    api.get<RepositoryPolicy>(`/api/projects/${encodeURIComponent(projectId)}/policy`, { params: { token }, silent: true } as AtlasRequestConfig);

export const listProjectUsers = (projectId: string, token: string) =>
    api.get<{
        users: { email: string; name: string; role: string; github_login?: string | null }[];
        pending: { login: string; permission: string }[];
    }>(`/api/projects/${encodeURIComponent(projectId)}/users`, { params: { token }, silent: true } as AtlasRequestConfig);

export const setUserRole = (email: string, role: string, token: string) =>
    api.put<{ email: string; role: string }>(`/api/users/${encodeURIComponent(email)}/role`, null, { params: { token, role }, silent: true } as AtlasRequestConfig);

export const addGrant = (projectId: string, token: string, grant: { subject_value: string; subject_type?: string; path?: string; effect?: string; permissions: NodeAccess; windows?: TimeWindow[]; expires_at?: number }) =>
    api.post<RepositoryPolicy>(`/api/projects/${encodeURIComponent(projectId)}/grants`, grant, { params: { token }, silent: true } as AtlasRequestConfig);

export const removeGrant = (projectId: string, token: string, grant: { subject_value: string; subject_type?: string; path?: string }) =>
    api.delete<RepositoryPolicy>(`/api/projects/${encodeURIComponent(projectId)}/grants`, { params: { token }, data: grant, silent: true } as AtlasRequestConfig);

export const updateManager = (projectId: string, token: string, email: string, action: "add" | "remove") =>
    api.post<{ status: string; managers: string[] }>(`/api/projects/${encodeURIComponent(projectId)}/managers`, { email, action }, { params: { token }, silent: true } as AtlasRequestConfig);

export const updateProjectStatus = (projectId: string, token: string, status: ProjectStatus) =>
    api.put<{ status: ProjectStatus }>(`/api/projects/${encodeURIComponent(projectId)}/status`, { status }, { params: { token }, silent: true } as AtlasRequestConfig);

export const deleteProject = (projectId: string, token: string) =>
    api.delete<{ status: string }>(`/api/projects/${encodeURIComponent(projectId)}`, { params: { token }, silent: true } as AtlasRequestConfig);

export const revokeProjectMembership = (projectId: string, token: string) =>
    api.delete<{ status: string; project_id: string }>(`/api/projects/${encodeURIComponent(projectId)}/membership`, { params: { token }, silent: true } as AtlasRequestConfig);

export const createAccessRequest = (projectId: string, token: string, resourcePath: string, reason: string) => {
    const data = new FormData();
    data.append("resource_path", resourcePath);
    data.append("reason", reason);
    data.append("token", token);
    return api.post<AccessRequest>(`/api/projects/${encodeURIComponent(projectId)}/access-requests`, data, { silent: true } as AtlasRequestConfig);
};

export const listAccessRequests = (projectId: string, token: string) =>
    api.get<{ requests: AccessRequest[] }>(`/api/projects/${encodeURIComponent(projectId)}/access-requests`, { params: { token }, silent: true } as AtlasRequestConfig);

export const resolveAccessRequest = (projectId: string, token: string, requestId: string, action: "approve" | "reject" | "temporary", durationHours?: number) => {
    const data = new FormData();
    data.append("action", action);
    data.append("token", token);
    if (durationHours) data.append("duration_hours", String(durationHours));
    return api.post<{ status: string }>(`/api/projects/${encodeURIComponent(projectId)}/access-requests/${encodeURIComponent(requestId)}`, data, { silent: true } as AtlasRequestConfig);
};

export const syncCollaborators = (projectId: string, token: string) => {
    const data = new FormData();
    data.append("token", token);
    return api.post<{ snapshot: { login: string; permission: string }[] }>(`/api/projects/${encodeURIComponent(projectId)}/sync-collaborators`, data, { silent: true } as AtlasRequestConfig);
};

export const listDeveloperProjects = (token: string) =>
    api.get<{ projects: DeveloperProject[] }>("/api/developer/projects", { params: { token }, silent: true } as AtlasRequestConfig);

export const searchProject = (projectId: string, query: string, scope: "metadata" | "source", token: string) =>
    api.get<{ query: string; scope: string; results: SearchResult[] }>(`/api/projects/${encodeURIComponent(projectId)}/search`, { params: { q: query, scope, token }, silent: true } as AtlasRequestConfig);

export const exportProject = (projectId: string, format: "json" | "report", token: string) =>
    api.get<unknown>(`/api/projects/${encodeURIComponent(projectId)}/export`, { params: { format, token }, silent: true } as AtlasRequestConfig);

export const updateDefaultAccess = (projectId: string, token: string, permissions: NodeAccess) =>
    api.put<RepositoryPolicy>(`/api/projects/${encodeURIComponent(projectId)}/policy/default`, { permissions }, { params: { token }, silent: true } as AtlasRequestConfig);

export const listPolicyVersions = (projectId: string, token: string) =>
    api.get<{ versions: PolicyVersion[] }>(`/api/projects/${encodeURIComponent(projectId)}/policy/versions`, { params: { token }, silent: true } as AtlasRequestConfig);

export const restorePolicyVersion = (projectId: string, token: string, version: number) => {
    const data = new FormData();
    data.append("token", token);
    return api.post<RepositoryPolicy>(`/api/projects/${encodeURIComponent(projectId)}/policy/versions/${version}/restore`, data, { silent: true } as AtlasRequestConfig);
};

export const listTeams = (token: string, projectId?: string) =>
    api.get<{ teams: Team[] }>("/api/teams", { params: { token, project_id: projectId || "" }, silent: true } as AtlasRequestConfig);

export const createTeam = (token: string, name: string, members: string[], projectId?: string) =>
    api.post<Team>("/api/teams", { name, members, project_id: projectId || "" }, { params: { token }, silent: true } as AtlasRequestConfig);

export const updateTeam = (token: string, teamId: string, name: string, members: string[], projectId?: string) =>
    api.put<Team>(`/api/teams/${encodeURIComponent(teamId)}`, { name, members, project_id: projectId || "" }, { params: { token, project_id: projectId || "" }, silent: true } as AtlasRequestConfig);

export const deleteTeam = (token: string, teamId: string, projectId?: string) =>
    api.delete<{ status: string }>(`/api/teams/${encodeURIComponent(teamId)}`, { params: { token, project_id: projectId || "" }, silent: true } as AtlasRequestConfig);

export const getProjectSecrets = (projectId: string, token: string) =>
    api.get<{ count: number; secrets: SecretFinding[] }>(`/api/projects/${encodeURIComponent(projectId)}/secrets`, { params: { token }, silent: true } as AtlasRequestConfig);

export const getAdminAnalytics = (token: string) =>
    api.get<AdminAnalytics>("/api/admin/analytics", { params: { token }, silent: true } as AtlasRequestConfig);

export type AdminUser = {
    email: string;
    name: string;
    role: string;
    github_login?: string | null;
    created_at?: number;
};

export const getAdminUsers = (token: string) =>
    api.get<{ users: AdminUser[] }>("/api/admin/users", { params: { token }, silent: true } as AtlasRequestConfig);

export type AdminProject = {
    project_id: string;
    project: string;
    owner_email: string;
    source: "zip" | "github";
    status: string;
    managers: string[];
    grants: number;
    collaborators: number;
    organization_id: string;
};

export const listAdminProjects = (token: string) =>
    api.get<{ projects: AdminProject[] }>("/api/admin/projects", { params: { token }, silent: true } as AtlasRequestConfig);

export const getAdminProjectGraph = (projectId: string, token: string) =>
    api.get<ProjectGraph>(`/api/admin/projects/${encodeURIComponent(projectId)}/graph`, { params: { token }, silent: true } as AtlasRequestConfig);

export const getAdminAudit = (token: string, limit = 100, action?: string) =>
    api.get<{ events: AuditEvent[] }>("/api/admin/audit", { params: { token, limit, action: action ?? "" }, silent: true } as AtlasRequestConfig);

export const getAdminSecurityEvents = (token: string) =>
    api.get<{ new_alerts: SecurityEvent[]; events: SecurityEvent[] }>("/api/admin/security-events", { params: { token }, silent: true } as AtlasRequestConfig);

export const listOrganizations = (token: string) =>
    api.get<{ organizations: Organization[] }>("/api/organizations", { params: { token }, silent: true } as AtlasRequestConfig);

export const createOrganization = (token: string, name: string, members: string[]) =>
    api.post<Organization>("/api/organizations", { name, members }, { params: { token }, silent: true } as AtlasRequestConfig);

export const updateOrganization = (token: string, orgId: string, name: string, members: string[]) =>
    api.put<Organization>(`/api/organizations/${encodeURIComponent(orgId)}`, { name, members }, { params: { token }, silent: true } as AtlasRequestConfig);

export const deleteOrganization = (token: string, orgId: string) =>
    api.delete<{ status: string }>(`/api/organizations/${encodeURIComponent(orgId)}`, { params: { token }, silent: true } as AtlasRequestConfig);

export const assignOrganizationProject = (token: string, orgId: string, projectId: string) =>
    api.post<{ organization_id: string; project_id: string }>(`/api/organizations/${encodeURIComponent(orgId)}/projects/${encodeURIComponent(projectId)}`, null, { params: { token }, silent: true } as AtlasRequestConfig);

export const unassignOrganizationProject = (token: string, orgId: string, projectId: string) =>
    api.delete<{ organization_id: string; project_id: string }>(`/api/organizations/${encodeURIComponent(orgId)}/projects/${encodeURIComponent(projectId)}`, { params: { token }, silent: true } as AtlasRequestConfig);

export const getEffectivePermissions = (token: string, email: string, projectId: string) =>
    api.get<EffectivePermissions>("/api/admin/effective-permissions", { params: { token, email, project_id: projectId }, silent: true } as AtlasRequestConfig);

export const getPreviewGraph = (token: string, email: string, projectId: string) =>
    api.get<PreviewGraph>("/api/admin/preview-graph", { params: { token, email, project_id: projectId }, silent: true } as AtlasRequestConfig);

export default api;
