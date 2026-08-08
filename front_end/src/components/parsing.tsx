import { useEffect, useMemo, useRef, useState } from "react";
import { cancelUpload, getUploadProgress, getUploadResult, uploadProject } from "../services/api";
import type { ProjectGraph, UploadProgress } from "../types/project";

const PARTICLE_ICONS = ["code", "javascript", "css", "html", "terminal", "functions", "settings", "data_object", "folder", "description"];

const PHASES: Record<UploadProgress["phase"], { label: string; range: [number, number] }> = {
    uploading: { label: "Phase 00: Uploading Archive", range: [0, 30] },
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

type ParsingScreenProps = {
    file: File;
    uploadId: string;
    onComplete: (graph: ProjectGraph) => void;
    onError: (message: string) => void;
    onCancel: () => void;
};

export default function ParsingScreen({ file, uploadId, onComplete, onError, onCancel }: ParsingScreenProps) {
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
        void uploadProject(file, uploadId, (event) => {
            if (event.total) setNetworkPct((event.loaded / event.total) * 100);
        }).then((response) => {
            const body = response.data as { status?: string };
            if (body.status === "error") onError("The project failed to process.");
        }).catch((error: unknown) => {
            if (cancelRef.current) return;
            const detail = error && typeof error === "object" && "response" in error ? (error.response as { data?: { detail?: string } })?.data?.detail : undefined;
            onError(detail ?? "Could not analyze that project.");
        });
    }, [file, onError, uploadId]);

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
                const response = await getUploadProgress(uploadId);
                if (!alive) return;
                const snapshot = response.data as UploadProgress;
                setServerProgress(snapshot);

                if (snapshot.phase === "done" && !doneRef.current) {
                    doneRef.current = true;
                    const resultResponse = await getUploadResult(uploadId);
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
    }, [onComplete, onError, uploadId]);

    useEffect(() => {
        if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
    }, [logs]);

    const progress = serverProgress ? Math.min(100, (serverProgress.phase === "uploading" ? NETWORK_PHASE_MAX * (networkPct / 100) : NETWORK_PHASE_MAX + ((100 - NETWORK_PHASE_MAX) * serverProgress.progress) / 100)) : NETWORK_PHASE_MAX * (networkPct / 100);
    const phase: UploadProgress["phase"] = serverProgress?.phase ?? "uploading";
    const phaseLabel = PHASES[phase].label;

    const elapsedSeconds = serverProgress?.elapsed_seconds ?? (Date.now() - uploadStartedAt) / 1000;
    let estimatedRemaining = serverProgress?.remaining_seconds ?? 0;
    if (!serverProgress && networkPct > 0) {
        const elapsed = (Date.now() - uploadStartedAt) / 1000;
        const remainingBytes = file.size * (1 - networkPct / 100);
        estimatedRemaining = Math.round(remainingBytes / (file.size / elapsed));
    }
    estimatedRemaining = Math.max(0, Math.round(estimatedRemaining));

    const bytesProcessed = serverProgress?.bytes_processed ?? (file.size * networkPct) / 100;
    const totalBytes = serverProgress?.total_bytes ?? file.size;
    const filesProcessed = serverProgress?.files_processed ?? (serverProgress?.phase === "extracting" ? serverProgress.files_processed : 0);
    const throughput = (bytesProcessed / (elapsedSeconds || 1)) / (1024 * 1024);

    const handleCancel = () => {
        cancelRef.current = true;
        void cancelUpload(uploadId).catch(() => undefined);
        onCancel();
    };

    return (
        <div className="ca-parse">
            <div className="ca-parse-bg">
                <div className="ca-parse-grid" />
                <div className="ca-parse-core" />
                {particles.map((particle) => (
                    <div
                        key={particle.id}
                        className="ca-parse-particle"
                        style={{
                            width: particle.size,
                            height: particle.size,
                            left: `${particle.left}%`,
                            top: `${particle.top}%`,
                            animationDuration: `${particle.duration}s`,
                            animationDelay: `${particle.delay}s`,
                        }}
                    >
                        <span className="material-symbols-outlined" style={{ fontSize: particle.size / 2, color: "rgba(0, 122, 255, .25)" }}>{particle.icon}</span>
                    </div>
                ))}
                <div className="ca-parse-overlay" />
            </div>

            <header className="ca-parse-nav">
                <div className="ca-parse-brand">
                    <span className="ca-brand-mark">✦</span>
                    <span className="ca-brand-word">CODE ATLAS</span>
                    <span style={{ width: 1, height: 16, background: "#30363d", margin: "0 8px" }} />
                    <span className="ca-label" style={{ color: "#c1c6d7" }}>Ingestion Engine V4.0</span>
                </div>
                <div className="ca-nav-right">
                    <span className="ca-parse-conn"><span className="ping" />STABLE CONNECTION</span>
                    <button className="ca-parse-cancel" onClick={handleCancel}><span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>Cancel</button>
                </div>
            </header>

            <main className="ca-parse-main">
                <div className="ca-parse-wrap">
                    <div className="ca-parse-card">
                        <div className="ca-parse-glow" />
                        <div className="ca-parse-card-inner">
                            <div className="ca-parse-scanner">
                                <div className="ca-parse-scanline" />
                                <span className="ca-parse-corner tl" />
                                <span className="ca-parse-corner tr" />
                                <span className="ca-parse-corner bl" />
                                <span className="ca-parse-corner br" />
                                <div className="ca-parse-scanner-inner"><span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>folder_zip</span></div>
                            </div>
                            <div className="ca-parse-progress">
                                <div className="ca-parse-title-row">
                                    <div>
                                        <h1>Parsing Repository Archive</h1>
                                        <p className="ca-parse-file">Project: <strong style={{ color: "#dfe2eb" }}>{file.name}</strong></p>
                                    </div>
                                    <span className="pct">{progress.toFixed(1)}%</span>
                                </div>
                                <div>
                                    <div className="ca-parse-bar"><div className="ca-parse-bar-fill" style={{ width: `${progress}%` }}><div className="ca-parse-bar-march" /></div></div>
                                    <div className="ca-parse-phase" style={{ marginTop: 8 }}>
                                        <span>{phaseLabel}</span>
                                        <span>EST. {estimatedRemaining}s REMAINING</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="ca-parse-bottom-grid">
                        <div className="ca-parse-logs">
                            <div className="ca-parse-logs-head">
                                <span>PARSING_LOGS.EXE</span>
                                <span className="dots"><i /><i /></span>
                            </div>
                            <div className="ca-parse-log-body" ref={logRef}>
                                {logs.map((line, index) => <span key={index} className="ca-parse-log-line">{line}</span>)}
                            </div>
                        </div>
                        <div className="ca-parse-metrics">
                            <div className="ca-parse-metric">
                                <span className="k">FILE_COUNT</span>
                                <span className="v">{filesProcessed.toLocaleString()}</span>
                                <span className="badge">PROCESSED</span>
                            </div>
                            <div className="ca-parse-metric green">
                                <span className="k">DATA_READ</span>
                                <span className="v">{formatBytes(bytesProcessed)}</span>
                                <span className="badge">EXTRACTED</span>
                            </div>
                            <div className="ca-parse-throughput">
                                <div>
                                    <span className="k">THROUGHPUT</span>
                                    <div className="val" style={{ marginTop: 6 }}>{throughput.toFixed(1)} MB/s</div>
                                </div>
                                <div className="ca-parse-bars">
                                    {barHeights.map((height, index) => <i key={index} style={{ height: `${height * 100}%` }} />)}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            <footer className="ca-parse-footer">
                <div>
                    <span className="ca-parse-footer">● ENGINE: ACTIVE</span>
                    <span style={{ opacity: .5 }}>HEARTBEAT: 12ms</span>
                </div>
                <div>
                    <span>EST. SIZE: {formatBytes(totalBytes)}</span>
                    <span className="blue" style={{ marginLeft: 16 }}>SYSTEM_READY_PENDING_INGESTION</span>
                </div>
            </footer>
        </div>
    );
}
