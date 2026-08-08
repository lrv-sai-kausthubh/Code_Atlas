import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, CSSProperties, ReactNode } from "react";
import { applyNodeChanges, Background, Controls, Handle, MarkerType, MiniMap, Position, ReactFlow, ReactFlowProvider, SelectionMode, useEdgesState, useNodesState, useReactFlow } from "@xyflow/react";
import type { Edge, Node, NodeChange, NodeProps, OnNodeDrag, XYPosition } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import ParsingScreen from "../components/parsing";
import { projectFileUrl } from "../services/api";
import type { ProjectGraph, ProjectNode, RepositoryAnalysis } from "../types/project";

const colors: Record<ProjectNode["type"], string> = {
    project: "#f2b84b",
    folder: "#64d5c4",
    file: "#9ca9ff",
};

type AtlasNodeData = ProjectNode & { onSelect: (node: ProjectNode) => void; onToggle: (nodeId: string) => void; selected: boolean };
type AtlasNode = Node<AtlasNodeData, "atlas">;
type NodeMovement = { id: string; delta: XYPosition };

function AtlasNodeView({ data }: NodeProps<AtlasNode>) {
    const color = colors[data.type];
    return (
        <div className={`atlas-node atlas-node-${data.type} ${data.selected ? "is-selected" : ""}`} style={{ "--node-color": color } as CSSProperties} onClick={() => data.onSelect(data)}>
            <Handle type="target" position={Position.Top} className="atlas-handle" />
            <div className={`atlas-node-dot ${data.type === "file" ? fileIcon(data.label).className : ""}`}>
                <span className="material-symbols-outlined">{data.type === "project" ? "account_tree" : data.type === "folder" ? "folder" : fileIcon(data.label).name}</span>
            </div>
            <div className="atlas-node-label" title={data.path || data.label}>{data.label}</div>
            {data.type !== "file" && <div className="atlas-node-kind">{data.type}</div>}
            <Handle type="source" position={Position.Bottom} className="atlas-handle" />
        </div>
    );
}

const nodeTypes = { atlas: AtlasNodeView };

function fileIcon(label: string) {
    const extension = label.toLowerCase().split(".").pop() ?? "";
    const icons: Record<string, { name: string; className: string }> = {
        html: { name: "html", className: "file-icon-html" },
        css: { name: "css", className: "file-icon-css" },
        scss: { name: "css", className: "file-icon-css" },
        js: { name: "javascript", className: "file-icon-js" },
        jsx: { name: "javascript", className: "file-icon-js" },
        ts: { name: "code", className: "file-icon-ts" },
        tsx: { name: "code", className: "file-icon-ts" },
        py: { name: "data_object", className: "file-icon-py" },
        json: { name: "data_object", className: "file-icon-json" },
        md: { name: "article", className: "file-icon-md" },
        svg: { name: "image", className: "file-icon-svg" },
        png: { name: "image", className: "file-icon-img" },
        jpg: { name: "image", className: "file-icon-img" },
        jpeg: { name: "image", className: "file-icon-img" },
        gif: { name: "image", className: "file-icon-img" },
        webp: { name: "image", className: "file-icon-img" },
        pdf: { name: "picture_as_pdf", className: "file-icon-pdf" },
        zip: { name: "folder_zip", className: "file-icon-zip" },
        tar: { name: "folder_zip", className: "file-icon-zip" },
        gz: { name: "folder_zip", className: "file-icon-zip" },
        txt: { name: "description", className: "file-icon-other" },
        yml: { name: "tune", className: "file-icon-json" },
        yaml: { name: "tune", className: "file-icon-json" },
        toml: { name: "tune", className: "file-icon-json" },
        lock: { name: "enhanced_encryption", className: "file-icon-json" },
    };
    return icons[extension] ?? { name: "description", className: "file-icon-misc" };
}

const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "ico", "avif"]);
const PDF_EXTENSION = "pdf";

function isPreviewable(node: ProjectNode) {
    if (node.type !== "file") return false;
    const extension = node.label.toLowerCase().split(".").pop() ?? "";
    return IMAGE_EXTENSIONS.has(extension) || extension === PDF_EXTENSION;
}

function FilePreview({ node, projectId }: { node: ProjectNode; projectId: string }) {
    const extension = node.label.toLowerCase().split(".").pop() ?? "";
    const src = projectFileUrl(projectId, node.path);
    const isImage = IMAGE_EXTENSIONS.has(extension);
    return (
        <div className="file-preview">
            <div className="preview-bar"><span>PREVIEW · {extension.toUpperCase()}</span><a href={src} target="_blank" rel="noreferrer">OPEN</a></div>
            {isImage ? <img src={src} alt={node.label} /> : <iframe src={src} title={node.label} />}
        </div>
    );
}

function formatBytes(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function AnalysisDrawer({ analysis }: { analysis: RepositoryAnalysis }) {
    const scoreColor = analysis.health_score >= 80 ? "#64d5c4" : analysis.health_score >= 60 ? "#f2b84b" : "#f17c71";
    return <section className="analysis-drawer"><div className="analysis-summary"><div className="health-score" style={{ "--score-color": scoreColor, "--score-angle": `${analysis.health_score * 3.6}deg` } as CSSProperties}><strong>{analysis.health_score}</strong><span>/ 100</span></div><div><p className="analysis-kicker">ARCHITECTURE HEALTH</p><h2>{analysis.health_score >= 80 ? "Healthy foundation" : analysis.health_score >= 60 ? "Worth investigating" : "Needs attention"}</h2><p className="analysis-muted">Calculated from dependency cycles, orphan files, and oversized modules.</p></div></div><div className="analysis-metrics"><div><span>LINES OF CODE</span><strong>{analysis.total_lines.toLocaleString()}</strong></div><div><span>IMPORTS</span><strong>{analysis.total_imports}</strong></div><div><span>AVG DEPENDENCIES</span><strong>{analysis.average_dependencies}</strong></div><div><span>LONGEST CHAIN</span><strong>{analysis.longest_import_chain.length} files</strong></div></div><div className="analysis-findings"><div><span className="finding-label">CIRCULAR DEPENDENCIES</span><strong className={analysis.circular_dependencies.length ? "finding-bad" : "finding-good"}>{analysis.circular_dependencies.length || "None detected"}</strong>{analysis.circular_dependencies.length > 0 && <small>{analysis.circular_dependencies[0].join(" → ")}</small>}</div><div><span className="finding-label">ORPHAN FILES</span><strong className={analysis.orphan_files.length ? "finding-warn" : "finding-good"}>{analysis.orphan_files.length}</strong>{analysis.orphan_files.length > 0 && <small>{analysis.orphan_files.slice(0, 2).join(" · ")}{analysis.orphan_files.length > 2 ? " · ..." : ""}</small>}</div><div><span className="finding-label">LARGEST FILE</span><strong>{analysis.largest_file?.path ?? "-"}</strong><small>{analysis.largest_file ? `${analysis.largest_file.lines.toLocaleString()} lines · ${formatBytes(analysis.largest_file.size_bytes)}` : "No files"}</small></div></div></section>;
}

function ExplorerTree({ graph, query, selected, collapsed, onSelect, onToggle }: { graph: ProjectGraph; query: string; selected: ProjectNode | null; collapsed: Set<string>; onSelect: (node: ProjectNode) => void; onToggle: (nodeId: string) => void }) {
    const children = new Map<string, ProjectNode[]>();
    graph.edges.filter((edge) => edge.relation !== "IMPORTS").forEach((edge) => {
        const child = graph.nodes.find((node) => node.id === edge.target);
        if (child) children.set(edge.source, [...(children.get(edge.source) ?? []), child]);
    });
    const renderNode = (node: ProjectNode, depth: number): ReactNode => {
        const isFolder = node.type === "folder";
        const icon = isFolder ? { name: collapsed.has(node.id) ? "folder" : "folder_open", className: "file-icon folder-chevron" } : fileIcon(node.label);
        return <div key={node.id}><button className={`file-row ${selected?.id === node.id ? "selected" : ""}`} style={{ paddingLeft: `${4 + depth * 14}px` }} onClick={() => { onSelect(node); if (isFolder) onToggle(node.id); }}><span className={`file-icon ${icon.className}`}><span className="material-symbols-outlined">{icon.name}</span></span><span className="file-row-label">{node.label}</span><small>{node.type}</small></button>{isFolder && !collapsed.has(node.id) && (children.get(node.id) ?? []).map((child) => renderNode(child, depth + 1))}</div>;
    };
    if (query) return <>{graph.nodes.filter((node) => node.label.toLowerCase().includes(query.toLowerCase()) && node.id !== "root").map((node) => renderNode(node, 0))}</>;
    return <>{(children.get("root") ?? []).map((node) => renderNode(node, 0))}</>;
}

function makeLayout(graph: ProjectGraph, onSelect: (node: ProjectNode) => void, onToggle: (nodeId: string) => void, compact: boolean, positionOffsets: ReadonlyMap<string, XYPosition>) {
    const children = new Map<string, string[]>();
    graph.edges.filter((edge) => edge.relation !== "IMPORTS").forEach((edge) => {
        const group = children.get(edge.source) ?? [];
        group.push(edge.target);
        children.set(edge.source, group);
    });
    const nodesById = new Map(graph.nodes.map((node) => [node.id, node]));
    const widths = new Map<string, number>();
    const measure = (nodeId: string): number => {
        const childIds = children.get(nodeId) ?? [];
        const width = childIds.length ? childIds.reduce((sum, childId) => sum + measure(childId), 0) : 1;
        widths.set(nodeId, width);
        return width;
    };
    measure("root");
    const nodes: AtlasNode[] = [];
    const place = (nodeId: string, depth: number, start: number) => {
        const node = nodesById.get(nodeId);
        if (!node) return;
        const width = widths.get(nodeId) ?? 1;
        const childIds = children.get(nodeId) ?? [];
        const center = start + width / 2;
            const offset = positionOffsets.get(node.id) ?? { x: 0, y: 0 };
            nodes.push({ id: node.id, type: "atlas", position: { x: center * (compact ? 112 : 150) + offset.x, y: depth * (compact ? 122 : 160) + offset.y }, data: { ...node, onSelect, onToggle, selected: false } });
        let childStart = start;
        childIds.forEach((childId) => {
            place(childId, depth + 1, childStart);
            childStart += widths.get(childId) ?? 1;
        });
    };
    place("root", 0, -(widths.get("root") ?? 1) / 2);

    const cycleNodes = new Set(graph.analysis.circular_dependencies.flatMap((cycle) => cycle.map((path) => `file:${path}`)));
    const edges: Edge[] = graph.edges.map((edge) => {
        const isImport = edge.relation === "IMPORTS";
        const isCycle = isImport && cycleNodes.has(edge.source) && cycleNodes.has(edge.target);
        const edgeColor = isCycle ? "var(--cycle-edge)" : isImport ? "var(--import-edge)" : "var(--graph-edge)";
        return {
            id: edge.id,
            source: edge.source,
            target: edge.target,
            type: isImport ? "bezier" : "smoothstep",
            animated: isImport,
            label: isCycle ? "CYCLE" : isImport ? "IMPORTS" : undefined,
            markerEnd: isImport ? { type: MarkerType.ArrowClosed, color: edgeColor } : undefined,
            style: { stroke: edgeColor, strokeWidth: isImport ? 1.8 : 1.2, strokeDasharray: isImport ? "5 4" : undefined },
            labelStyle: { fill: "var(--graph-label)", fontSize: 8, fontFamily: "DM Mono, monospace" },
            labelBgStyle: { fill: "var(--graph-surface)", fillOpacity: 0.9 },
        };
    });
    return { nodes, edges };
}

function GraphCanvas({ graph, collapsed, selected, onSelect, onToggle, compact, positionOffsets, onMoveNodes }: { graph: ProjectGraph; collapsed: Set<string>; selected: ProjectNode | null; onSelect: (node: ProjectNode) => void; onToggle: (nodeId: string) => void; compact: boolean; positionOffsets: ReadonlyMap<string, XYPosition>; onMoveNodes: (movements: NodeMovement[]) => void }) {
    const { fitView, zoomIn, zoomOut } = useReactFlow();
    const parentById = useMemo(() => {
        const parents = new Map<string, string>();
        graph.edges.filter((edge) => edge.relation !== "IMPORTS").forEach((edge) => parents.set(edge.target, edge.source));
        return parents;
    }, [graph]);
    const hiddenIds = useMemo(() => {
        const hidden = new Set<string>();
        graph.nodes.forEach((node) => {
            let parent = parentById.get(node.id);
            while (parent) {
                if (collapsed.has(parent)) {
                    hidden.add(node.id);
                    break;
                }
                parent = parentById.get(parent);
            }
        });
        return hidden;
    }, [collapsed, graph.nodes, parentById]);
    const initial = useMemo(() => makeLayout(graph, onSelect, onToggle, compact, positionOffsets), [compact, graph, onSelect, onToggle, positionOffsets]);
    const [nodes, setNodes] = useNodesState<AtlasNode>(initial.nodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initial.edges);
    const [zoom, setZoom] = useState(1);
    const [isDragging, setIsDragging] = useState(false);
    const hasFittedInitialView = useRef(false);
    const previousCompact = useRef(compact);
    const nodesRef = useRef(nodes);
    const dragStart = useRef<Map<string, XYPosition>>(new Map());

    useEffect(() => {
        nodesRef.current = nodes;
    }, [nodes]);

    useEffect(() => {
        const frame = requestAnimationFrame(() => {
            if (!hasFittedInitialView.current) {
                fitView({ padding: 0.18, duration: 350 });
                hasFittedInitialView.current = true;
            }
        });
        return () => cancelAnimationFrame(frame);
    }, [fitView]);

    useEffect(() => {
        const reflow = previousCompact.current !== compact;
        previousCompact.current = compact;
        setNodes((currentNodes) => {
            const currentById = new Map(currentNodes.map((node) => [node.id, node]));
            return initial.nodes.map((node) => {
                const existing = currentById.get(node.id);
                const nextNode = existing && !reflow ? { ...node, position: existing.position } : node;
                return { ...nextNode, hidden: hiddenIds.has(node.id) };
            });
        });
        setEdges(initial.edges.map((edge) => ({ ...edge, hidden: hiddenIds.has(edge.source) || hiddenIds.has(edge.target) })));
    }, [compact, hiddenIds, initial, setEdges, setNodes]);

    useEffect(() => {
        setNodes((currentNodes) => currentNodes.map((node) => ({ ...node, data: { ...node.data, selected: node.id === selected?.id } })));
    }, [selected?.id, setNodes]);

    const descendantsById = useMemo(() => {
        const descendants = new Map<string, Set<string>>();
        graph.nodes.forEach((ancestor) => {
            const members = new Set<string>();
            graph.nodes.forEach((candidate) => {
                let parent = parentById.get(candidate.id);
                while (parent) {
                    if (parent === ancestor.id) {
                        members.add(candidate.id);
                        break;
                    }
                    parent = parentById.get(parent);
                }
            });
            descendants.set(ancestor.id, members);
        });
        return descendants;
    }, [graph.nodes, parentById]);

    const onNodesChange = useCallback((changes: NodeChange<AtlasNode>[]) => {
        const currentNodes = nodesRef.current;
        const nextNodes = applyNodeChanges(changes, currentNodes);
        const movedAncestors = changes.filter((change) => change.type === "position").flatMap((change) => {
            const before = currentNodes.find((node) => node.id === change.id);
            const after = nextNodes.find((node) => node.id === change.id);
            if (!before || !after || before.position.x === after.position.x && before.position.y === after.position.y) return [];
            const delta = { x: after.position.x - before.position.x, y: after.position.y - before.position.y };
            return before.data.type === "folder" || before.data.type === "project" ? [{ id: change.id, delta }] : [];
        });
        const changedPositionIds = new Set(changes.filter((change) => change.type === "position").map((change) => change.id));
        const descendantMovement = new Map<string, XYPosition>();
        movedAncestors.forEach(({ id, delta }) => {
            descendantsById.get(id)?.forEach((descendantId) => {
                const currentDelta = descendantMovement.get(descendantId) ?? { x: 0, y: 0 };
                descendantMovement.set(descendantId, { x: currentDelta.x + delta.x, y: currentDelta.y + delta.y });
            });
        });
        const translatedNodes = descendantMovement.size ? nextNodes.map((node) => {
            if (changedPositionIds.has(node.id)) return node;
            const delta = descendantMovement.get(node.id);
            return delta ? { ...node, position: { x: node.position.x + delta.x, y: node.position.y + delta.y } } : node;
        }) : nextNodes;
        nodesRef.current = translatedNodes;
        setNodes(translatedNodes);
    }, [descendantsById, setNodes]);

    const onNodeDragStart: OnNodeDrag<AtlasNode> = useCallback((_, _node, draggedNodes) => {
        setIsDragging(true);
        dragStart.current = new Map(draggedNodes.map((draggedNode) => [draggedNode.id, { ...draggedNode.position }]));
    }, []);

    const onNodeDragStop: OnNodeDrag<AtlasNode> = useCallback((_, _node, draggedNodes) => {
        const starts = dragStart.current;
        dragStart.current = new Map();
        setIsDragging(false);
        const movements = draggedNodes.flatMap((draggedNode) => {
            const start = starts.get(draggedNode.id);
            if (!start) return [];
            const delta = { x: draggedNode.position.x - start.x, y: draggedNode.position.y - start.y };
            return delta.x || delta.y ? [{ id: draggedNode.id, delta }] : [];
        });
        if (movements.length) onMoveNodes(movements);
    }, [onMoveNodes]);

    return (
        <div className="react-flow-shell">
            <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onNodeDragStart={onNodeDragStart} onNodeDragStop={onNodeDragStop} onNodeClick={(_, node) => { onSelect(node.data); if (node.data.type === "folder") onToggle(node.id); }} nodesDraggable nodesConnectable={false} selectionOnDrag selectionMode={SelectionMode.Partial} panOnDrag={[1, 2]} onMove={(_, viewport) => setZoom(viewport.zoom)} minZoom={0.08} maxZoom={2.5} proOptions={{ hideAttribution: true }}>
                <Background color="var(--graph-grid)" gap={28} size={1} />
                <Controls showInteractive={false} />
                {!isDragging && <MiniMap nodeColor={(node) => colors[(node.data as AtlasNodeData).type]} maskColor="var(--minimap-mask)" pannable zoomable />}
            </ReactFlow>
            <div className="graph-hint">DRAG ON CANVAS TO LASSO <span>·</span> MIDDLE-CLICK TO PAN <span>·</span> DRAG NODES</div>
            <div className="graph-zoom-readout">{Math.round(zoom * 100)}%</div>
            <div className="graph-toolbar-buttons"><button onClick={() => zoomIn({ duration: 200 })}>+</button><button onClick={() => zoomOut({ duration: 200 })}>−</button><button onClick={() => fitView({ padding: 0.18, duration: 350 })}>FIT</button></div>
        </div>
    );
}

function Home() {
    const inputRef = useRef<HTMLInputElement>(null);
    const [graph, setGraph] = useState<ProjectGraph | null>(null);
    const [parsingFile, setParsingFile] = useState<File | null>(null);
    const [parsingUploadId, setParsingUploadId] = useState("");
    const [projectId, setProjectId] = useState("");
    const [selected, setSelected] = useState<ProjectNode | null>(null);
    const [query, setQuery] = useState("");
    const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
    const [compact, setCompact] = useState(false);
    const [analysisOpen, setAnalysisOpen] = useState(false);
    const [positionOffsets, setPositionOffsets] = useState<Map<string, XYPosition>>(new Map());
    const [theme, setTheme] = useState<"dark" | "light">(() => (localStorage.getItem("codeatlas-theme") as "dark" | "light") || "dark");
    const [dragging, setDragging] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        document.documentElement.dataset.theme = theme;
        localStorage.setItem("codeatlas-theme", theme);
    }, [theme]);

    const toggleFolder = useCallback((nodeId: string) => {
        setCollapsed((current) => {
            const next = new Set(current);
            if (next.has(nodeId)) next.delete(nodeId);
            else next.add(nodeId);
            return next;
        });
    }, []);

    const parentById = useMemo(() => {
        const parents = new Map<string, string>();
        graph?.edges.filter((edge) => edge.relation !== "IMPORTS").forEach((edge) => parents.set(edge.target, edge.source));
        return parents;
    }, [graph]);

    const moveNodes = useCallback((movements: NodeMovement[]) => {
        if (!graph) return;
        const isDescendant = (candidateId: string, ancestorId: string) => {
            let parent = parentById.get(candidateId);
            while (parent) {
                if (parent === ancestorId) return true;
                parent = parentById.get(parent);
            }
            return false;
        };
        const roots = movements.filter((movement) => !movements.some((other) => other.id !== movement.id && isDescendant(movement.id, other.id)));
        setPositionOffsets((current) => {
            const next = new Map(current);
            graph.nodes.forEach((node) => {
                const movement = roots.filter((root) => node.id === root.id || isDescendant(node.id, root.id)).reduce((total, root) => ({ x: total.x + root.delta.x, y: total.y + root.delta.y }), { x: 0, y: 0 });
                if (!movement.x && !movement.y) return;
                const offset = next.get(node.id) ?? { x: 0, y: 0 };
                next.set(node.id, { x: offset.x + movement.x, y: offset.y + movement.y });
            });
            return next;
        });
    }, [graph, parentById]);

    const visibleGraph = useMemo(() => {
        if (!graph) return null;
        const parentById = new Map<string, string>();
        graph.edges.filter((edge) => edge.relation !== "IMPORTS").forEach((edge) => parentById.set(edge.target, edge.source));
        const isVisible = (nodeId: string) => {
            let parent = parentById.get(nodeId);
            while (parent) {
                if (collapsed.has(parent)) return false;
                parent = parentById.get(parent);
            }
            return true;
        };
        const nodes = graph.nodes.filter((node) => isVisible(node.id));
        const nodeIds = new Set(nodes.map((node) => node.id));
        return { ...graph, nodes, edges: graph.edges.filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target)) };
    }, [collapsed, graph]);

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

    const folderIds = useMemo(() => graph?.nodes.filter((node) => node.type === "folder").map((node) => node.id) ?? [], [graph]);
    const collapseAll = useCallback(() => setCollapsed(new Set(folderIds)), [folderIds]);
    const expandAll = useCallback(() => setCollapsed(new Set()), []);

    return (
        <main className="app-shell">
            <header className="topbar">
                <div className="brand"><span className="brand-mark">✦</span><span>CODEATLAS</span><small>V1 / MILESTONE 1</small></div>
                <div className="topbar-actions"><span className="api-status"><i /> API CONNECTED</span><button className="theme-toggle" onClick={() => setTheme((value) => value === "dark" ? "light" : "dark")} aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}>{theme === "dark" ? "☼ LIGHT" : "◐ DARK"}</button><button className="new-project" onClick={() => inputRef.current?.click()}>+ NEW PROJECT</button></div>
            </header>

            {parsingFile ? <ParsingScreen file={parsingFile} uploadId={parsingUploadId} onComplete={(nextGraph) => { setGraph(nextGraph); setProjectId(nextGraph.project_id ?? ""); setCollapsed(new Set()); setCompact(false); setPositionOffsets(new Map()); setSelected(nextGraph.nodes[0] ?? null); setParsingFile(null); }} onError={(message) => { setError(message); setParsingFile(null); }} onCancel={() => { setParsingFile(null); setError("Upload cancelled."); }} /> : !graph ? <section className="landing"><div className="eyebrow">SOFTWARE ARCHITECTURE / 001</div><h1>See the shape<br /><em>of your code.</em></h1><p className="intro">Upload a project archive and turn its structure into a living map. Start with the files. Discover the system.</p><button className="drop-zone" onClick={() => inputRef.current?.click()} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); void chooseFile(event.dataTransfer.files[0]); }}><span className="upload-icon">↑</span><strong>{dragging ? "DROP TO MAP" : "DROP YOUR ZIP HERE"}</strong><span>or <u>browse files</u> · max 200 MB</span></button>{error && <p className="error-message">{error}</p>}<div className="landing-notes"><span><b>01</b> Upload archive</span><span><b>02</b> Scan structure</span><span><b>03</b> Explore graph</span></div><div className="orbit orbit-one" /><div className="orbit orbit-two" /></section> : <section className="workspace">
                <aside className="explorer panel"><div className="panel-heading"><span>PROJECT EXPLORER</span><span className="muted">{graph.files} FILES</span></div><div className="project-name"><span className="folder-dot" />{graph.project}</div><input className="search" placeholder="Filter files..." value={query} onChange={(event) => setQuery(event.target.value)} /><div className="file-list"><ExplorerTree graph={graph} query={query} selected={selected} collapsed={collapsed} onSelect={setSelected} onToggle={toggleFolder} /></div><div className="legend"><span><i style={{ background: colors.file }} /> FILE</span><span><i style={{ background: colors.folder }} /> FOLDER</span></div></aside>
                 <div className="graph-panel panel"><div className="graph-toolbar"><div><span className="live-dot" /> STRUCTURE MAP <span className="toolbar-separator">/</span> {visibleGraph?.nodes.length ?? 0} OF {graph.nodes.length} NODES</div><div className="graph-actions"><button className={analysisOpen ? "active" : ""} onClick={() => setAnalysisOpen((value) => !value)}>ANALYSIS</button><button className={compact ? "active" : ""} onClick={() => setCompact((value) => !value)}>{compact ? "RELAX" : "TIGHTEN"}</button><button onClick={collapseAll}>COLLAPSE ALL</button><button onClick={expandAll}>EXPAND ALL</button></div></div>{analysisOpen && <AnalysisDrawer analysis={graph.analysis} />}<ReactFlowProvider><GraphCanvas graph={graph} collapsed={collapsed} selected={selected} onSelect={setSelected} onToggle={toggleFolder} compact={compact} positionOffsets={positionOffsets} onMoveNodes={moveNodes} /></ReactFlowProvider></div>
                 <aside className="inspector panel"><div className="panel-heading"><span>INSPECTOR</span><span className="muted">{selected ? selected.type.toUpperCase() : "NONE"}</span></div><div className="stats"><div><strong>{graph.files}</strong><span>FILES</span></div><div><strong>{graph.folders}</strong><span>FOLDERS</span></div><div><strong>{Object.keys(graph.languages).length}</strong><span>LANGUAGES</span></div></div>{selected ? <><div className="inspector-icon" style={{ color: colors[selected.type] }}><span className="material-symbols-outlined">{selected.type === "file" ? fileIcon(selected.label).name : selected.type === "folder" ? "folder" : "account_tree"}</span></div><h2>{selected.label}</h2><p className="path">{selected.path || "/"}</p><div className="detail-block"><span>NODE TYPE</span><strong>{selected.type}</strong></div>{selected.language && <div className="detail-block"><span>LANGUAGE</span><strong>{selected.language}</strong></div>}{selected.type === "file" && <><div className="detail-block"><span>LINES</span><strong>{selected.lines?.toLocaleString() ?? "-"}</strong></div><div className="detail-block"><span>SIZE</span><strong>{selected.size_bytes === undefined ? "-" : formatBytes(selected.size_bytes)}</strong></div></>}<div className="detail-block"><span>RELATIONSHIP</span><strong>CONTAINS / IMPORTS</strong></div>{projectId && isPreviewable(selected) && <FilePreview node={selected} projectId={projectId} />}</> : <p className="empty-inspector">Select a node in the map to see its details.</p>}</aside>
            </section>}
            <input ref={inputRef} type="file" accept=".zip,application/zip" hidden onChange={onFileChange} />
        </main>
    );
}

export default Home;
