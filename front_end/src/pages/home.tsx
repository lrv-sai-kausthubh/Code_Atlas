import { useCallback, useEffect, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import type { XYPosition } from "@xyflow/react";
import LandingView from "../components/workspace/landing-view";
import ParsingScreen from "../components/parsing";
import StateLab from "../components/state-lab";
import TopBar from "../components/workspace/topbar";
import WorkspaceLayout from "../components/workspace/workspace-layout";
import { toastEmpty } from "../services/toast";
import type { ProjectGraph, ProjectNode } from "../types/project";

function Home() {
    const inputRef = useRef<HTMLInputElement>(null);
    const [graph, setGraph] = useState<ProjectGraph | null>(null);
    const [parsingFile, setParsingFile] = useState<File | null>(null);
    const [parsingUploadId, setParsingUploadId] = useState("");
    const [projectId, setProjectId] = useState("");
    const [selected, setSelected] = useState<ProjectNode | null>(null);
    const [positionOffsets, setPositionOffsets] = useState<
        Map<string, XYPosition>
    >(new Map());
    const [theme, setTheme] = useState<"dark" | "light">(
        () =>
            (localStorage.getItem("codeatlas-theme") as "dark" | "light") || "dark",
    );
    const [dragging, setDragging] = useState(false);
    const [error, setError] = useState("");
    const [stateLabOpen, setStateLabOpen] = useState(false);

    useEffect(() => {
        document.documentElement.dataset.theme = theme;
        localStorage.setItem("codeatlas-theme", theme);
    }, [theme]);

    const handleSelect = useCallback((node: ProjectNode) => {
        setSelected(node);
    }, []);

    const handleMoveNodes = useCallback((next: Map<string, XYPosition>) => {
        setPositionOffsets(next);
    }, []);

    const chooseFile = async (file?: File) => {
        if (!file) return;
        setError("");
        const uploadId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
        setParsingUploadId(uploadId);
        setParsingFile(file);
    };

    const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
        void chooseFile(event.target.files?.[0]);
        event.target.value = "";
    };

    return (
        <main className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_72%_20%,#1a2424_0,transparent_32%),#101112] light:bg-[radial-gradient(circle_at_72%_20%,#dbeae5_0,transparent_34%),#eef1ed]">
            <TopBar
                theme={theme}
                onToggleTheme={() =>
                    setTheme((value) => (value === "dark" ? "light" : "dark"))
                }
                onToggleStateLab={() => setStateLabOpen((value) => !value)}
                onNewProject={() => inputRef.current?.click()}
            />

            {parsingFile ? (
                <ParsingScreen
                    file={parsingFile}
                    uploadId={parsingUploadId}
                    onComplete={(nextGraph) => {
                        setGraph(nextGraph);
                        setProjectId(nextGraph.project_id ?? "");
                        setPositionOffsets(new Map());
                        setSelected(nextGraph.nodes[0] ?? null);
                        setParsingFile(null);
                        if (!nextGraph.files || nextGraph.files === 0) {
                            toastEmpty("This archive contains no analyzable files.");
                        }
                    }}
                    onError={(message) => {
                        setError(message);
                        setParsingFile(null);
                    }}
                    onCancel={() => {
                        setParsingFile(null);
                        setError("Upload cancelled.");
                    }}
                />
            ) : !graph ? (
                <LandingView
                    dragging={dragging}
                    error={error}
                    onBrowse={() => inputRef.current?.click()}
                    onDragOver={(event) => {
                        event.preventDefault();
                        setDragging(true);
                    }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={(event) => {
                        event.preventDefault();
                        setDragging(false);
                        void chooseFile(event.dataTransfer.files[0]);
                    }}
                />
            ) : (
                <WorkspaceLayout
                    graph={graph}
                    projectId={projectId}
                    selected={selected}
                    onSelect={handleSelect}
                    positionOffsets={positionOffsets}
                    onMoveNodes={handleMoveNodes}
                />
            )}

            <input
                ref={inputRef}
                type="file"
                accept=".zip,application/zip"
                hidden
                onChange={onFileChange}
            />
            {stateLabOpen && <StateLab onClose={() => setStateLabOpen(false)} />}
        </main>
    );
}

export default Home;
