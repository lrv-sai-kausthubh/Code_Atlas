import { useEffect, useMemo, useRef, useState } from "react";
import { Braces, Code, Database, File, FileCode, Folder, FolderArchive, Palette, Settings, Terminal, X } from "lucide-react";
import { cancelUpload, getUploadProgress, getUploadResult, importConnectedRepo, importGithubProject, uploadProject } from "../services/api";
import type { GitHubRepo } from "../services/api";
import { toastLoading, toastSuccess, toastDismiss } from "../services/toast";
import type { ProjectGraph, UploadProgress } from "../types/project";

const PARTICLE_ICONS = [Code, Braces, Palette, FileCode, Terminal, Braces, Settings, Database, Folder, File];

const PHASES: Record<UploadProgress["phase"], { label: string; range: [number, number] }> = {
    uploading: { label: "Phase 00: Uploading Archive", range: [0, 30] },
    downloading: { label: "Phase 00: Fetching Repository", range: [0, 30] },
    extracting: { label: "Phase 01: Extracting Archive", range: [30, 82] },
    analyzing: { label: "Phase 02: Graph Assembly", range: [82, 98] },
    done: { label: "Phase 03: Complete", range: [98, 100] },
    error: { label: "Phase 03: Failed", range: [98, 100] },
};

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

function ParticleIcon({ icon, size }: { icon: typeof Code; size: number }) {
    const Icon = icon;
    return <Icon size={size} className="text-[rgba(0,122,255,.25)]" strokeWidth={1.4} />;
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
    const lastLoggedFile = useRef("");
    const logRef = useRef<HTMLDivElement>(null);

    const particles = useMemo(() => Array.from({ length: 16 }, (_, index) => {
        const size = Math.random() * 34 + 12;
        return {
            id: index,
            left: Math.random() * 100,
            top: Math.random() * 100,
            size,
            duration: Math.random() * 3 + 3,
            delay: Math.random() * 4,
            icon: PARTICLE_ICONS[Math.floor(Math.random() * PARTICLE_ICONS.length)],
        };
    }), []);

    useEffect(() => {
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
            onError(detail ?? "Could not analyze that project.");
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

    const elapsedSeconds = serverProgress?.elapsed_seconds ?? (Date.now() - uploadStartedAt) / 1000;
    let estimatedRemaining = serverProgress?.remaining_seconds ?? 0;
    if (!serverProgress && networkPct > 0 && file) {
        const elapsed = (Date.now() - uploadStartedAt) / 1000;
        const remainingBytes = file.size * (1 - networkPct / 100);
        estimatedRemaining = Math.round(remainingBytes / (file.size / elapsed));
    }
    estimatedRemaining = Math.max(0, Math.round(estimatedRemaining));

    const bytesProcessed = serverProgress?.bytes_processed ?? (file ? (file.size * networkPct) / 100 : 0);
    const totalBytes = serverProgress?.total_bytes ?? file?.size ?? 0;
    const filesProcessed = serverProgress?.files_processed ?? (serverProgress?.phase === "extracting" ? serverProgress.files_processed : 0);
    const throughput = (bytesProcessed / (elapsedSeconds || 1)) / (1024 * 1024);

    const handleCancel = () => {
        cancelRef.current = true;
        void cancelUpload(uploadId).catch(() => undefined);
        onCancel();
    };

    return (
        <div className="h-screen bg-[#080a0d] text-[#dfe2eb] font-inter overflow-hidden relative">
            <div className="fixed inset-0 z-0 overflow-hidden">
                <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#30363d_1px,transparent_1px)] bg-[size:24px_24px]" />
                <div className="absolute top-1/2 left-1/2 w-[600px] h-[600px] -translate-x-1/2 -translate-y-1/2 border border-[#30363d] rounded-full opacity-10 flex items-center justify-center before:content-[''] before:absolute before:w-[400px] before:h-[400px] before:border-2 before:border-[rgba(0,122,255,.2)] before:rounded-full before:animate-pulse" />
                {particles.map((particle) => (
                    <div
                        key={particle.id}
                        className="absolute border border-[rgba(0,122,255,.3)] bg-[rgba(38,42,49,.4)] flex items-center justify-center animate-absorb pointer-events-none"
                        style={{
                            width: particle.size,
                            height: particle.size,
                            left: `${particle.left}%`,
                            top: `${particle.top}%`,
                            animationDuration: `${particle.duration}s`,
                            animationDelay: `${particle.delay}s`,
                        }}
                    >
                        <ParticleIcon icon={particle.icon} size={particle.size / 2} />
                    </div>
                ))}
                <div className="absolute inset-0 bg-[rgba(8,10,13,.6)] backdrop-blur-[2px]" />
            </div>

            <header className="fixed top-0 left-0 right-0 z-50 h-14 flex items-center justify-between px-4 border-b border-[#30363d] bg-[rgba(8,10,13,.8)] backdrop-blur-[12px]">
                <div className="flex items-center gap-[10px]">
                    <img src="/codeAtlas_logo.png" alt="Code Atlas" className="w-7 h-7 rounded-full object-contain" />
                    <span className="font-space font-bold tracking-[-.04em] text-[#007aff] text-lg">CODE ATLAS</span>
                    <span style={{ width: 1, height: 16, background: "#30363d", margin: "0 8px" }} />
                    <span className="font-jet tracking-[.05em] uppercase" style={{ color: "#c1c6d7" }}>Ingestion Engine V4.0</span>
                </div>
                <div className="flex items-center gap-[14px]">
                    <span className="flex items-center gap-2 font-jet text-xs text-[#10b981]"><span className="w-2 h-2 rounded-full bg-[#10b981] animate-ping" />STABLE CONNECTION</span>
                    <button className="flex items-center gap-2 px-4 py-2 border border-[#30363d] bg-transparent text-[#c1c6d7] font-jet text-[10px] tracking-[.08em] uppercase cursor-pointer transition-[border-color,color] duration-200 hover:border-[#007aff] hover:text-[#dfe2eb]" onClick={handleCancel}><X size={18} />Cancel</button>
                </div>
            </header>

            <main className="relative z-10 h-[calc(100vh-56px-32px)] flex items-center justify-center p-4 overflow-hidden">
                <div className="w-full max-w-[880px] flex flex-col gap-6 max-h-full">
                    <div className="relative">
                        <div className="absolute -inset-1 bg-[linear-gradient(90deg,rgba(0,122,255,.2),rgba(139,92,246,.2))] blur-[18px] opacity-25" />
                        <div className="relative bg-[#10141a] border border-[#30363d] p-8 flex gap-8 items-center overflow-hidden max-[760px]:flex-col max-[760px]:items-start">
                            <div className="relative w-[176px] h-[176px] flex-[0_0_176px] bg-[#181c22] border border-[#30363d] overflow-hidden max-[760px]:w-[120px] max-[760px]:h-[120px]">
                                <div className="absolute left-0 right-0 h-[2px] bg-[linear-gradient(to_right,transparent,#007aff,transparent)] animate-scanline" />
                                <span className="absolute w-2 h-2 top-0 left-0 border-t border-l border-[#007aff]" />
                                <span className="absolute w-2 h-2 top-0 right-0 border-t border-r border-[#007aff]" />
                                <span className="absolute w-2 h-2 bottom-0 left-0 border-b border-l border-[#007aff]" />
                                <span className="absolute w-2 h-2 bottom-0 right-0 border-b border-r border-[#007aff]" />
                                <div className="absolute inset-4 border border-[rgba(0,122,255,.2)] flex items-center justify-center"><FolderArchive size={44} className="text-[#007aff]" strokeWidth={1.4} /></div>
                            </div>
                            <div className="flex-1 flex flex-col gap-6">
                                <div className="flex justify-between items-end">
                                    <div>
                                        <h1 className="font-space text-xl font-semibold mt-0 mb-0">{isGithub ? "Importing Repository From GitHub" : "Parsing Repository Archive"}</h1>
                                        <p className="text-sm text-[#c1c6d7] mt-1 mb-0">Project: <strong style={{ color: "#dfe2eb" }}>{projectName}</strong></p>
                                    </div>
                                    <span className="font-jet text-base text-[#007aff]">{progress.toFixed(1)}%</span>
                                </div>
                                <div>
                                    <div className="h-3 bg-[#31353c] border border-[#30363d] overflow-hidden relative"><div className="h-full bg-[#007aff] relative transition-[width] duration-300 after:content-[''] after:absolute after:top-0 after:right-0 after:bottom-0 after:w-4 after:bg-[rgba(255,255,255,.2)] after:blur-[4px]" style={{ width: `${progress}%` }}><div className="absolute inset-0 bg-[linear-gradient(45deg,rgba(0,122,255,.15)_25%,transparent_25%,transparent_50%,rgba(0,122,255,.15)_50%,rgba(0,122,255,.15)_75%,transparent_75%,transparent)] bg-[size:20px_20px] animate-march" /></div></div>
                                    <div className="flex justify-between font-jet text-[10px] tracking-[.08em] uppercase text-[#c1c6d7]" style={{ marginTop: 8 }}>
                                        <span>{phaseLabel}</span>
                                        <span>EST. {estimatedRemaining}s REMAINING</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-6 max-[760px]:grid-cols-1">
                        <div className="bg-[#181c22] border border-[#30363d] h-[192px] flex flex-col">
                            <div className="flex justify-between items-center px-4 py-2 border-b border-[#30363d] bg-[#10141a] font-jet text-[10px] tracking-[.08em] text-[#c1c6d7]">
                                <span>PARSING_LOGS.EXE</span>
                                <span className="flex gap-1"><i className="w-2 h-2 bg-[#30363d]" /><i className="w-2 h-2 bg-[#30363d]" /></span>
                            </div>
                            <div className="flex-1 p-4 overflow-hidden font-jet text-xs text-[rgba(193,198,215,.8)] flex flex-col gap-1.5 [mask-image:linear-gradient(to_bottom,transparent,black_18%,black_82%,transparent)]" ref={logRef}>
                                {logs.map((line, index) => <span key={index} className="animate-slide">{line}</span>)}
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-[#10141a] border border-[#30363d] p-4 flex flex-col justify-between min-h-[88px]">
                                <span className="font-jet text-[10px] tracking-[.08em] text-[#c1c6d7]">FILE_COUNT</span>
                                <span className="font-space text-[32px] font-bold leading-none text-[#007aff]">{filesProcessed.toLocaleString()}</span>
                                <span className="mt-2 w-fit font-jet text-[9px] text-[#4c1a00] bg-[#ef6719] px-1.5 py-0.5">PROCESSED</span>
                            </div>
                            <div className="bg-[#10141a] border border-[#30363d] p-4 flex flex-col justify-between min-h-[88px]">
                                <span className="font-jet text-[10px] tracking-[.08em] text-[#c1c6d7]">DATA_READ</span>
                                <span className="font-space text-[32px] font-bold leading-none text-[#10b981]">{formatBytes(bytesProcessed)}</span>
                                <span className="mt-2 w-fit font-jet text-[9px] text-[#00311f] bg-[#00a572] px-1.5 py-0.5">EXTRACTED</span>
                            </div>
                            <div className="col-span-2 bg-[#10141a] border border-[#30363d] p-4 flex justify-between items-center">
                                <div>
                                    <span className="font-jet text-[10px] tracking-[.08em] text-[#c1c6d7]">THROUGHPUT</span>
                                    <div className="font-jet text-sm text-[#dfe2eb]" style={{ marginTop: 6 }}>{throughput.toFixed(1)} MB/s</div>
                                </div>
                                <div className="flex gap-1 h-8 items-end">
                                    {barHeights.map((height, index) => <i key={index} className="w-1 bg-[#007aff]" style={{ height: `${height * 100}%` }} />)}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            <footer className="fixed bottom-0 left-0 right-0 z-50 h-8 flex items-center justify-between px-4 border-t border-[#30363d] bg-[#181c22] font-jet text-[10px] tracking-[.08em] text-[#c1c6d7]">
                <div>
                    <span>● ENGINE: ACTIVE</span>
                    <span style={{ opacity: .5 }}>HEARTBEAT: 12ms</span>
                </div>
                <div>
                    <span>EST. SIZE: {formatBytes(totalBytes)}</span>
                    <span className="text-[#007aff]" style={{ marginLeft: 16 }}>SYSTEM_READY_PENDING_INGESTION</span>
                </div>
            </footer>
        </div>
    );
}
