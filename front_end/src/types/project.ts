export type ProjectNode = {
    id: string;
    label: string;
    path: string;
    type: "project" | "folder" | "file";
    language?: string;
    size_bytes?: number;
    lines?: number;
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
};

export type UploadProgress = {
    status: "uploading" | "processing" | "complete" | "error" | "cancelled";
    phase: "uploading" | "extracting" | "analyzing" | "done" | "error";
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
