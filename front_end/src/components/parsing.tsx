import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { cancelUpload, getUploadProgress, getUploadResult, importConnectedRepo, importGithubProject, uploadProject } from "../services/api";
import type { GitHubRepo } from "../services/api";
import { toastLoading, toastSuccess, toastDismiss } from "../services/toast";
import type { ProjectGraph, UploadProgress } from "../types/project";

const PHASES: Record<UploadProgress["phase"], { label: string; range: [number, number] }> = {
    uploading: { label: "Uploading archive", range: [0, 30] },
    downloading: { label: "Fetching repository", range: [0, 30] },
    extracting: { label: "Extracting archive", range: [30, 82] },
    analyzing: { label: "Graph assembly", range: [82, 98] },
    done: { label: "Complete", range: [98, 100] },
    error: { label: "Failed", range: [98, 100] },
};

const PIPELINE = [
    "Repository received",
    "Scanning files",
    "Detecting languages",
    "Parsing source code",
    "Resolving dependencies",
    "Building architecture graph",
    "Preparing visualization",
];

const LOG_PATTERNS = [
    (file: string) => `Extracting ${file}...`,
    (file: string) => `Reading source from ${file}`,
    (file: string) => `Indexing symbols in ${file}`,
    (file: string) => `Resolving imports referenced by ${file}`,
    (file: string) => `Normalizing schemas for ${file}`,
    (file: string) => `Mapping cross-references for ${file}`,
    (file: string) => `Validating checksums for ${file}`,
];

const NETWORK_PHASE_MAX = 30;

function formatBytes(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function pipelineIndex(progress: number): number {
    if (progress < 30) return 0;
    if (progress < 50) return 1;
    if (progress < 60) return 2;
    if (progress < 70) return 3;
    if (progress < 85) return 4;
    if (progress < 97) return 5;
    return 6;
}

type ParsingScreenProps = {
    file?: File;
    repoUrl?: string;
    connectedRepo?: GitHubRepo;
    authToken?: string;
    uploadId: string;
    onComplete: (graph: ProjectGraph) => void;
    onError: (message: string) => void;
    onCancel: () => void;
};

function repoDisplayName(repoUrl: string) {
    const parts = repoUrl.trim().replace(/\.git$/, "").replace(/\/$/, "").split("/");
    return parts[parts.length - 1] || repoUrl;
}

export default function ParsingScreen({ file, repoUrl, connectedRepo, authToken, uploadId, onComplete, onError, onCancel }: ParsingScreenProps) {
    const isGithub = Boolean(repoUrl) || Boolean(connectedRepo);
    const isConnectedRepo = Boolean(connectedRepo);
    const projectName = isConnectedRepo
        ? (connectedRepo as GitHubRepo).full_name
        : isGithub
            ? repoDisplayName(repoUrl as string)
            : file?.name ?? "";
    const sessionToken = authToken ?? localStorage.getItem("codeatlas-token") ?? "";
    const [serverProgress, setServerProgress] = useState<UploadProgress | null>(null);
    const [networkPct, setNetworkPct] = useState(0);
    const [uploadStartedAt] = useState(() => Date.now());
    const [logs, setLogs] = useState<string[]>(["> Initializing ingestion engine..."]);
    const [barHeights, setBarHeights] = useState([0.4, 0.6, 0.8, 0.5, 0.9, 0.65, 0.75]);
    const doneRef = useRef(false);
    const cancelRef = useRef(false);
    const startedRef = useRef(false);
    const lastLoggedFile = useRef("");
    const logRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (startedRef.current) return;
        startedRef.current = true;
        const loadingId = toastLoading(`Analyzing ${projectName}…`);
        const startRequest = isConnectedRepo
            ? importConnectedRepo(`https://github.com/${(connectedRepo as GitHubRepo).full_name}`, uploadId, authToken as string)
            : isGithub
                ? importGithubProject(repoUrl as string, uploadId, sessionToken)
                : uploadProject(file as File, uploadId, (event) => {
                    if (event.total) setNetworkPct((event.loaded / event.total) * 100);
                }, sessionToken);
        void startRequest.then((response) => {
            const body = response.data as { status?: string };
            if (body.status === "error") {
                toastDismiss(loadingId);
                onError("The project failed to process.");
            }
        }).catch((error: unknown) => {
            toastDismiss(loadingId);
            if (cancelRef.current) return;
            const detail = error && typeof error === "object" && "response" in error ? (error.response as { data?: { detail?: string } })?.data?.detail : undefined;
            const code = error && typeof error === "object" && "code" in error ? String((error as { code?: string }).code) : "";
            if (detail) onError(detail);
            else if (code === "ERR_NETWORK") onError("Backend unreachable. Start the API server (uvicorn app.main:app) or set VITE_API_URL to the deployed backend.");
            else onError("Could not analyze that project.");
        });
        return () => {
            toastDismiss(loadingId);
        };
    }, [authToken, connectedRepo, file, isConnectedRepo, isGithub, onError, projectName, repoUrl, sessionToken, uploadId]);

    useEffect(() => {
        const interval = setInterval(() => {
            setBarHeights((heights) => heights.map(() => Math.random() * 0.5 + 0.4));
        }, 300);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        let alive = true;
        const poll = async () => {
            try {
                const response = await getUploadProgress(uploadId, sessionToken);
                if (!alive) return;
                const snapshot = response.data as UploadProgress;
                setServerProgress(snapshot);

                if (snapshot.phase === "done" && !doneRef.current) {
                    doneRef.current = true;
                    const resultResponse = await getUploadResult(uploadId, sessionToken);
                    toastSuccess(`Project "${projectName}" mapped successfully.`);
                    if (alive) onComplete(resultResponse.data as ProjectGraph);
                    return;
                }
                if (snapshot.status === "error" && !doneRef.current) {
                    doneRef.current = true;
                    onError(snapshot.error ?? "The project failed to process.");
                    return;
                }
                const current = snapshot.current_file;
                if (current && current !== lastLoggedFile.current) {
                    lastLoggedFile.current = current;
                    const pattern = LOG_PATTERNS[Math.floor(Math.random() * LOG_PATTERNS.length)];
                    setLogs((prev) => [...prev.slice(-11), `> ${pattern(current)}`]);
                }
            } catch (pollError) {
                if (alive && !doneRef.current && (pollError as { response?: { status?: number } }).response?.status !== 404) {
                    onError("Lost connection to the analysis engine.");
                }
            }
        };
        void poll();
        const interval = setInterval(() => void poll(), 500);
        return () => { alive = false; clearInterval(interval); };
    }, [projectName, onComplete, onError, sessionToken, uploadId]);

    useEffect(() => {
        if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
    }, [logs]);

    const progress = serverProgress ? Math.min(100, (serverProgress.phase === "uploading" ? NETWORK_PHASE_MAX * (networkPct / 100) : NETWORK_PHASE_MAX + ((100 - NETWORK_PHASE_MAX) * serverProgress.progress) / 100)) : NETWORK_PHASE_MAX * (networkPct / 100);
    const phase: UploadProgress["phase"] = serverProgress?.phase ?? "uploading";
    const phaseLabel = PHASES[phase].label;
    const activeIndex = pipelineIndex(progress);

    const elapsedSeconds = serverProgress?.elapsed_seconds ?? (Date.now() - uploadStartedAt) / 1000;
    let estimatedRemaining = serverProgress?.remaining_seconds ?? 0;
    if (!serverProgress && networkPct > 0 && file) {
        const elapsed = (Date.now() - uploadStartedAt) / 1000;
        const remainingBytes = file.size * (1 - networkPct / 100);
        estimatedRemaining = Math.round(remainingBytes / (file.size / elapsed));
    }
    estimatedRemaining = Math.max(0, Math.round(estimatedRemaining));

    const bytesProcessed = serverProgress?.bytes_processed ?? (file ? (file.size * networkPct) / 100 : 0);
    const filesProcessed = serverProgress?.files_processed ?? (serverProgress?.phase === "extracting" ? serverProgress.files_processed : 0);
    const throughput = (bytesProcessed / (elapsedSeconds || 1)) / (1024 * 1024);

    const handleCancel = () => {
        cancelRef.current = true;
        void cancelUpload(uploadId).catch(() => undefined);
        onCancel();
    };

    const failed = phase === "error";

    return (
        <div className="min-h-screen bg-[var(--ca-canvas)] text-[var(--ca-ink)] font-sans">
            <main className="mx-auto max-w-[1000px] px-[30px] py-12">
                <div className="mb-8 flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <div className="ca-badge mb-4">Ingestion engine</div>
                        <h1 className="ca-display-md m-0 text-[26px]">
                            {isGithub ? "Importing repository from GitHub" : "Analyzing repository"}
                        </h1>
                        <p className="ca-mono-label mt-2">{projectName}</p>
                    </div>
                    <button className="ca-btn-secondary !h-9 !text-[13px]" onClick={handleCancel}>
                        <X size={15} />
                        Cancel
                    </button>
                </div>

                <div className="ca-card p-6">
                    <div className="mb-3 flex items-end justify-between">
                        <span className="ca-label">{phaseLabel}</span>
                        <span className="ca-mono text-[14px] text-[var(--ca-primary)]">{progress.toFixed(1)}%</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-[var(--ca-surface-strong)]">
                        <div
                            className={`h-full rounded-full transition-[width] duration-300 ${failed ? "bg-[var(--ca-error)]" : "bg-[var(--ca-primary)]"}`}
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                    <div className="ca-mono-label mt-3 flex justify-between">
                        <span>{filesProcessed.toLocaleString()} files</span>
                        <span>~{estimatedRemaining}s remaining</span>
                    </div>
                </div>

                <div className="mt-6 grid gap-6 md:grid-cols-2">
                    <div className="ca-card overflow-hidden">
                        <div className="flex items-center justify-between border-b border-[var(--ca-hairline)] px-4 py-2.5">
                            <span className="ca-label">Analysis pipeline</span>
                            <span className="ca-mono-label">{isGithub ? "GITHUB REPO" : "ZIP ARCHIVE"}</span>
                        </div>
                        <ul className="m-0 flex list-none flex-col p-4">
                            {PIPELINE.map((stage, index) => {
                                const state = failed ? "idle" : index < activeIndex ? "done" : index === activeIndex ? "active" : "idle";
                                return (
                                    <li key={stage} className="flex items-center gap-3 border-b border-[var(--ca-hairline-soft)] py-2.5 last:border-0">
                                        <span className="grid h-4 w-4 shrink-0 place-items-center">
                                            {state === "done" ? (
                                                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                                                    <circle cx="8" cy="8" r="7.2" fill="none" stroke="var(--ca-success)" strokeWidth="1.6" />
                                                    <path d="m4.8 8.2 2.2 2.2 4.4-4.8" stroke="var(--ca-success)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                                                </svg>
                                            ) : state === "active" ? (
                                                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                                                    <circle cx="5" cy="5" r="5" fill="var(--ca-primary)" />
                                                    <circle className="animate-ping" cx="5" cy="5" r="5" fill="var(--ca-primary)" opacity=".5" />
                                                </svg>
                                            ) : (
                                                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                                                    <circle cx="8" cy="8" r="7.2" fill="none" stroke="var(--ca-hairline-strong)" strokeWidth="1.6" />
                                                </svg>
                                            )}
                                        </span>
                                        <span className={`ca-mono text-[12px] ${state === "idle" ? "text-[var(--ca-muted-soft)]" : "text-[var(--ca-ink)]"}`}>
                                            {stage}
                                        </span>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>

                    <div className="flex flex-col gap-4">
                        <div className="ca-card flex h-1 flex-col md:flex-1">
                            <div className="flex items-center justify-between border-b border-[var(--ca-hairline)] px-4 py-2.5">
                                <span className="ca-label">Ingestion log</span>
                            </div>
                            <div
                                ref={logRef}
                                className="ca-mono no-scrollbar max-h-[300px] flex-1 space-y-1.5 overflow-hidden p-4 text-[11px] leading-[1.6] text-[var(--ca-body)] [mask-image:linear-gradient(to_bottom,transparent,black_14%,black_86%,transparent)]"
                            >
                                {logs.map((line, index) => <span key={index} className="block animate-slide">{line}</span>)}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="ca-card flex flex-col justify-between gap-2 p-4">
                                <span className="ca-label">Files processed</span>
                                <span className="ca-mono text-[26px] leading-none text-[var(--ca-ink)]">{filesProcessed.toLocaleString()}</span>
                            </div>
                            <div className="ca-card flex flex-col justify-between gap-2 p-4">
                                <span className="ca-label">Data read</span>
                                <span className="ca-mono text-[26px] leading-none text-[var(--ca-ink)]">{formatBytes(bytesProcessed)}</span>
                            </div>
                            <div className="col-span-2 ca-card flex items-center justify-between p-4">
                                <div>
                                    <span className="ca-label">Throughput</span>
                                    <div className="ca-mono mt-1 text-[14px] text-[var(--ca-ink)]">{throughput.toFixed(1)} MB/s</div>
                                </div>
                                <div className="flex h-8 items-end gap-1">
                                    {barHeights.map((height, index) => <i key={index} className="w-1 rounded-full bg-[var(--ca-primary)] opacity-70" style={{ height: `${height * 100}%` }} />)}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}