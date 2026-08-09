export type NodeAccess = {
    metadata: boolean;
    graph: boolean;
    source: boolean;
    download: boolean;
};

export type ProjectNode = {
    id: string;
    label: string;
    path: string;
    type: "project" | "folder" | "file";
    language?: string;
    size_bytes?: number;
    lines?: number;
    access?: NodeAccess;
};

export type TimeWindow = {
    days: number[];
    start: string;
    end: string;
};

export type Grant = {
    subject_type: string;
    subject_value: string;
    path: string;
    effect: "allow" | "deny";
    permissions: NodeAccess;
    expires_at?: number | null;
    windows?: TimeWindow[];
};

export type ProjectStatus = "new" | "in_progress" | "completed";

export type RepositoryPolicy = {
    project_id: string;
    project: string;
    owner_email: string;
    source: "zip" | "github";
    github_owner?: string;
    github_repo?: string;
    managers: string[];
    default_access: NodeAccess;
    grants: Grant[];
    status?: ProjectStatus;
};

export type Team = {
    id: string;
    name: string;
    members: string[];
    created_at?: number;
};

export type PolicyVersion = {
    version: number;
    ts?: number;
    actor?: string;
    note?: string;
};

export type SearchResult = {
    id?: string;
    name?: string;
    path: string;
    type?: string;
    language?: string;
    access?: NodeAccess;
    line?: number;
    text?: string;
};

export type SecretFinding = {
    file: string;
    line?: number;
    label: string;
    severity: string;
    preview: string;
};

export type AuditEvent = {
    ts?: number;
    email: string;
    action: string;
    resource: string;
    detail?: Record<string, unknown>;
};

export type SecurityEvent = {
    id: string;
    kind: string;
    severity: string;
    email?: string;
    ts: number;
    window_seconds?: number;
    detail: Record<string, unknown>;
};

export type AdminAnalytics = {
    users: number;
    teams: number;
    repositories: number;
    grants_total: number;
    pending_access_requests: number;
    repositories_with_policy: number;
    coverage: {
        project_id: string;
        project: string;
        owner_email: string;
        grants: number;
        source_default: boolean;
    }[];
};

export type Organization = {
    id: string;
    name: string;
    owner_email: string;
    members: string[];
    created_at?: number;
    project_ids: string[];
};

export type ExplanationStep = {
    permission: string;
    path: string;
    effect: string;
    value: boolean;
    expires_at?: number;
};

export type EffectivePermissions = {
    email: string;
    role: string;
    teams: string[];
    owner: boolean;
    organization?: string;
    in_org: boolean;
    default_access: NodeAccess;
    effective_access: NodeAccess;
    explanation: {
        subject: string;
        teams: string[];
        resource: string;
        steps: ExplanationStep[];
    };
    grants: Grant[];
};

export type PreviewGraph = ProjectGraph & { _previewed_as?: string };

export type AccessRequest = {
    id: string;
    project_id: string;
    requester_email: string;
    requester_name: string;
    resource_path: string;
    permission: string;
    reason: string;
    status: "pending" | "approved" | "rejected";
    created_at: number;
};

export type DeveloperProject = {
    project_id: string;
    project: string;
    owner_email: string;
    source: "zip" | "github";
    access: NodeAccess;
    is_manager?: boolean;
    status?: ProjectStatus;
};

export type FunctionCall = {
    caller_file: string;          // relative path of the file making the call
    callee_name: string;          // function / component / symbol name
    callee_file: string | null;   // relative path of the target file (null = external)
    params: string[];             // parameter names from the function definition
    param_types: string[];        // inferred type labels (JSON, array, URL …)
    description: string;          // one-line human-readable description
    is_external: boolean;         // true when the call targets an npm/pip package
    external_lib: string | null;  // package name when is_external is true
};

export type FunctionInput = {
    name: string;
    type: string;
};

export type SourceCall = {
    name: string;
    target: string | null;
};

export type ApiCall = {
    provider: string;
    operation: string;
    expression: string;
};

export type SourceFunction = {
    name: string;
    signature: string;
    line_start: number;
    line_end: number;
    inputs: FunctionInput[];
    calls: SourceCall[];
    api_calls: ApiCall[];
    uses: string[];
    summary: string;
    snippet: string;
};

export type FileImportDetail = {
    path: string;
    names: string[];
};

export type FileDetails = {
    path: string;
    imports: FileImportDetail[];
    external_imports: string[];
    uses: string[];
    api_calls: ApiCall[];
    functions: SourceFunction[];
};

export type FileMetric = {
    path: string;
    size_bytes: number;
    lines: number;
};

export type SecurityIssue = {
    file: string;
    line: number;
    type: string;
    snippet: string;
};

export type RepositoryAnalysis = {
    total_lines: number;
    total_size_bytes: number;
    average_file_size_bytes: number;
    largest_file: FileMetric | null;
    smallest_file: FileMetric | null;
    total_imports: number;
    average_dependencies: number;
    longest_import_chain: { length: number; files: string[] };
    orphan_files: string[];
    circular_dependencies: string[][];
    security_issues: SecurityIssue[];
    health_score: number;
};

export type ProjectNodeType = ProjectNode["type"];

export type ProjectEdge = {
    id: string;
    source: string;
    target: string;
    label: string;
    relation?: "CONTAINS" | "IMPORTS";
};

export type ProjectGraph = {
    project_id: string;
    project: string;
    files: number;
    folders: number;
    languages: Record<string, number>;
    nodes: ProjectNode[];
    edges: ProjectEdge[];
    analysis: RepositoryAnalysis;
    function_calls?: FunctionCall[];  // populated for uploads processed after v1.1
    file_details?: Record<string, FileDetails>;
    node_access?: Record<string, NodeAccess>;
    owner_email?: string;
    is_manager?: boolean;
    policy_source?: "zip" | "github";
};

export type UploadProgress = {
    status: "uploading" | "processing" | "complete" | "error" | "cancelled";
    phase: "uploading" | "downloading" | "extracting" | "analyzing" | "done" | "error";
    progress: number;
    files_processed: number;
    total_files: number;
    bytes_processed: number;
    total_bytes: number;
    current_file: string;
    elapsed_seconds: number;
    remaining_seconds: number;
    error?: string | null;
};
