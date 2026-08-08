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
