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
    project: string;
    files: number;
    folders: number;
    languages: Record<string, number>;
    nodes: ProjectNode[];
    edges: ProjectEdge[];
    analysis: RepositoryAnalysis;
};
