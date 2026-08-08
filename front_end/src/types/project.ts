export type ProjectNode = {
    id: string;
    label: string;
    path: string;
    type: "project" | "folder" | "file";
    language?: string;
    size_bytes?: number;
    lines?: number;
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

export type FileMetric = {
    path: string;
    size_bytes: number;
    lines: number;
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
