import { useCallback, useMemo, useRef, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import type { XYPosition } from "@xyflow/react";
import AnalysisPanel from "./analysis-panel";
import ExplorerPanel from "./explorer-panel";
import GraphPanel from "./graph-panel";
import ImagePreview from "../preview/image-preview";
import InspectorPanel from "./inspector-panel";
import { toastProcessing } from "../../services/toast";
import type { NodeMovement } from "../atlas/atlas-types";
import type { ProjectGraph, ProjectNode } from "../../types/project";

function WorkspaceLayout({
    graph,
    projectId,
    selected,
    onSelect,
    positionOffsets,
    onMoveNodes,
}: {
    graph: ProjectGraph;
    projectId: string;
    selected: ProjectNode | null;
    onSelect: (node: ProjectNode) => void;
    positionOffsets: ReadonlyMap<string, XYPosition>;
    onMoveNodes: (next: Map<string, XYPosition>) => void;
}) {
    const [query, setQuery] = useState("");
    const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
    const [compact, setCompact] = useState(false);
    const [analysisOpen, setAnalysisOpen] = useState(false);
    const [previewNode, setPreviewNode] = useState<ProjectNode | null>(null);
    const [focusNodeId, setFocusNodeId] = useState<string | null>(null);
    const focusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [explorerWidth, setExplorerWidth] = useState(
        () => Number(localStorage.getItem("ca-explorer-width")) || 230,
    );
    const [inspectorWidth, setInspectorWidth] = useState(
        () => Number(localStorage.getItem("ca-inspector-width")) || 245,
    );
    const [analysisHeight, setAnalysisHeight] = useState(
        () => Number(localStorage.getItem("ca-analysis-height")) || 240,
    );
    const [explorerCollapsed, setExplorerCollapsed] = useState(
        () => localStorage.getItem("ca-explorer-collapsed") === "1",
    );
    const [inspectorCollapsed, setInspectorCollapsed] = useState(
        () => localStorage.getItem("ca-inspector-collapsed") === "1",
    );
    const resizingRef = useRef<"explorer" | "inspector" | "analysis" | null>(null);
    const layoutRootRef = useRef<HTMLElement>(null);

    const persistLayout = (key: string, value: number) =>
        localStorage.setItem(key, String(value));

    const startResize =
        (which: "explorer" | "inspector" | "analysis") =>
        (event: ReactPointerEvent) => {
            event.preventDefault();
            resizingRef.current = which;
            const originX = event.clientX;
            const originY = event.clientY;
            const wasExplorerCollapsed = explorerCollapsed;
            const wasInspectorCollapsed = inspectorCollapsed;
            const startExplorer = explorerWidth;
            const startInspector = inspectorWidth;
            const startAnalysis = analysisHeight;
            const root = layoutRootRef.current;
            document.body.style.cursor =
                which === "analysis" ? "row-resize" : "col-resize";
            document.body.style.userSelect = "none";

            const onMove = (move: PointerEvent) => {
                if (which === "explorer") {
                    const base = wasExplorerCollapsed ? 160 : startExplorer;
                    const next = Math.min(
                        560,
                        Math.max(160, base + (move.clientX - originX)),
                    );
                    setExplorerWidth(next);
                    persistLayout("ca-explorer-width", next);
                } else if (which === "inspector") {
                    const base = wasInspectorCollapsed ? 160 : startInspector;
                    const next = Math.min(
                        560,
                        Math.max(160, base - (move.clientX - originX)),
                    );
                    setInspectorWidth(next);
                    persistLayout("ca-inspector-width", next);
                } else {
                    const next = Math.min(
                        Math.max(120, startAnalysis - (move.clientY - originY)),
                        root ? root.clientHeight * 0.6 : 400,
                    );
                    setAnalysisHeight(next);
                    persistLayout("ca-analysis-height", next);
                }
            };
            const onUp = () => {
                resizingRef.current = null;
                document.body.style.cursor = "";
                document.body.style.userSelect = "";
                if (wasExplorerCollapsed) {
                    localStorage.setItem("ca-explorer-collapsed", "0");
                    setExplorerCollapsed(false);
                } else if (wasInspectorCollapsed) {
                    localStorage.setItem("ca-inspector-collapsed", "0");
                    setInspectorCollapsed(false);
                }
                window.removeEventListener("pointermove", onMove);
                window.removeEventListener("pointerup", onUp);
            };
            window.addEventListener("pointermove", onMove);
            window.addEventListener("pointerup", onUp);
        };

    const toggleExplorer = () => {
        setExplorerCollapsed((value) => {
            localStorage.setItem("ca-explorer-collapsed", value ? "0" : "1");
            return !value;
        });
    };
    const toggleInspector = () => {
        setInspectorCollapsed((value) => {
            localStorage.setItem("ca-inspector-collapsed", value ? "0" : "1");
            return !value;
        });
    };

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
        graph.edges
            .filter((edge) => edge.relation !== "IMPORTS")
            .forEach((edge) => parents.set(edge.target, edge.source));
        return parents;
    }, [graph]);

    const handleSelect = useCallback(
        (node: ProjectNode) => {
            onSelect(node);
            if (focusTimerRef.current) clearTimeout(focusTimerRef.current);
            setFocusNodeId(node.id);
            focusTimerRef.current = setTimeout(() => setFocusNodeId(null), 1800);
            if (node.type === "file") {
                setCollapsed((current) => {
                    const next = new Set(current);
                    let parent = parentById.get(node.id);
                    while (parent) {
                        next.delete(parent);
                        parent = parentById.get(parent);
                    }
                    return next;
                });
            }
            if (inspectorCollapsed) {
                localStorage.setItem("ca-inspector-collapsed", "0");
                setInspectorCollapsed(false);
            }
        },
        [inspectorCollapsed, onSelect, parentById],
    );

    const moveNodes = useCallback(
        (movements: NodeMovement[]) => {
            if (!graph) return;
            const isDescendant = (candidateId: string, ancestorId: string) => {
                let parent = parentById.get(candidateId);
                while (parent) {
                    if (parent === ancestorId) return true;
                    parent = parentById.get(parent);
                }
                return false;
            };
            const roots = movements.filter(
                (movement) =>
                    !movements.some(
                        (other) =>
                            other.id !== movement.id && isDescendant(movement.id, other.id),
                    ),
            );
            const next = new Map(positionOffsets);
            graph.nodes.forEach((node) => {
                const movement = roots
                    .filter(
                        (root) => node.id === root.id || isDescendant(node.id, root.id),
                    )
                    .reduce(
                        (total, root) => ({
                            x: total.x + root.delta.x,
                            y: total.y + root.delta.y,
                        }),
                        { x: 0, y: 0 },
                    );
                if (!movement.x && !movement.y) return;
                const offset = next.get(node.id) ?? { x: 0, y: 0 };
                next.set(node.id, {
                    x: offset.x + movement.x,
                    y: offset.y + movement.y,
                });
            });
            onMoveNodes(next);
        },
        [graph, onMoveNodes, parentById, positionOffsets],
    );

    const visibleGraph = useMemo(() => {
        const parentById = new Map<string, string>();
        graph.edges
            .filter((edge) => edge.relation !== "IMPORTS")
            .forEach((edge) => parentById.set(edge.target, edge.source));
        const isVisible = (nodeId: string) => {
            let parent = parentById.get(nodeId);
            while (parent) {
                if (collapsed.has(parent)) return false;
                parent = parentById.get(parent);
            }
            return true;
        };
        return graph.nodes.filter((node) => isVisible(node.id));
    }, [collapsed, graph]);

    const folderIds = useMemo(
        () =>
            graph.nodes
                .filter((node) => node.type === "folder")
                .map((node) => node.id),
        [graph],
    );
    const collapseAll = useCallback(() => {
        setCollapsed(new Set(folderIds));
        toastProcessing("Collapsing folder tree…");
    }, [folderIds]);
    const expandAll = useCallback(() => {
        setCollapsed(new Set());
        toastProcessing("Expanding folder tree…");
    }, []);
    const toggleCompact = useCallback(() => {
        setCompact((value) => !value);
        toastProcessing(`Re-laying out ${graph.nodes.length} nodes…`);
    }, [graph.nodes.length]);
    const toggleAnalysis = useCallback(
        () => setAnalysisOpen((value) => !value),
        [],
    );

    const gridCols = explorerCollapsed
        ? inspectorCollapsed
            ? "grid-cols-[0_0_minmax(0,1fr)_0_0]"
            : "grid-cols-[0_0_minmax(0,1fr)_4px_var(--inspector-width,245px)]"
        : inspectorCollapsed
            ? "grid-cols-[var(--explorer-width,230px)_4px_minmax(0,1fr)_0_0]"
            : "grid-cols-[var(--explorer-width,230px)_4px_minmax(0,1fr)_4px_var(--inspector-width,245px)]";
    const gridRows = analysisOpen
        ? "grid-rows-[minmax(0,1fr)_4px_auto]"
        : "grid-rows-[minmax(0,1fr)_0_0]";

    return (
        <section
            ref={layoutRootRef}
            className={`relative grid h-[calc(100vh-72px)] gap-0 p-3 ${gridCols} ${gridRows} max-[850px]:block max-[850px]:h-auto max-[850px]:min-h-[calc(100vh-72px)]`}
            style={
                {
                    "--explorer-width": explorerCollapsed
                        ? "0px"
                        : `${explorerWidth}px`,
                    "--inspector-width": inspectorCollapsed
                        ? "0px"
                        : `${inspectorWidth}px`,
                    "--analysis-height": `${analysisHeight}px`,
                } as CSSProperties
            }
        >
            <ExplorerPanel
                graph={graph}
                query={query}
                setQuery={setQuery}
                selected={selected}
                collapsed={collapsed}
                onSelect={handleSelect}
                onToggle={toggleFolder}
                explorerCollapsed={explorerCollapsed}
                onToggleCollapse={toggleExplorer}
            />
            {explorerCollapsed && (
                <button
                    className="absolute inset-y-0 left-0 z-[6] flex w-[18px] items-center justify-center border-0 border-r border-[#2b3030] bg-[#171a1ad9] text-[#79817e] transition-[background,color] duration-150 hover:bg-[#242d2b] hover:text-[#f2b84b] [&_.material-symbols-outlined]:text-[16px]"
                    title="Open explorer (click or drag)"
                    onPointerDown={startResize("explorer")}
                >
                    <span className="material-symbols-outlined">chevron_right</span>
                </button>
            )}
            <div
                className={`relative z-[5] col-start-2 row-start-1 cursor-col-resize before:absolute before:inset-y-0 before:left-px before:right-px before:bg-transparent before:transition-colors before:duration-150 hover:before:bg-[#2f3a37] light:hover:before:bg-[#b8c8c0] ${resizingRef.current === "explorer" ? "bg-[#3d4b47] light:bg-[#b8c8c0]" : ""} max-[850px]:hidden`}
                onPointerDown={startResize("explorer")}
            />
            <GraphPanel
                graph={graph}
                collapsed={collapsed}
                selected={selected}
                focusNodeId={focusNodeId}
                onSelect={handleSelect}
                onToggle={toggleFolder}
                compact={compact}
                onToggleCompact={toggleCompact}
                analysisOpen={analysisOpen}
                onToggleAnalysis={toggleAnalysis}
                onCollapseAll={collapseAll}
                onExpandAll={expandAll}
                positionOffsets={positionOffsets}
                onMoveNodes={moveNodes}
                visibleNodes={visibleGraph.length}
            />
            <div
                className={`relative z-[5] col-start-4 row-start-1 cursor-col-resize before:absolute before:inset-y-0 before:left-px before:right-px before:bg-transparent before:transition-colors before:duration-150 hover:before:bg-[#2f3a37] light:hover:before:bg-[#b8c8c0] ${resizingRef.current === "inspector" ? "bg-[#3d4b47] light:bg-[#b8c8c0]" : ""} max-[850px]:hidden`}
                onPointerDown={startResize("inspector")}
            />
            <InspectorPanel
                graph={graph}
                selected={selected}
                projectId={projectId}
                inspectorCollapsed={inspectorCollapsed}
                onToggleCollapse={toggleInspector}
                onOpenPreview={setPreviewNode}
            />
            {inspectorCollapsed && (
                <button
                    className="absolute inset-y-0 right-0 z-[6] flex w-[18px] items-center justify-center border-0 border-l border-[#2b3030] bg-[#171a1ad9] text-[#79817e] transition-[background,color] duration-150 hover:bg-[#242d2b] hover:text-[#f2b84b] [&_.material-symbols-outlined]:text-[16px]"
                    title="Open inspector (click or drag)"
                    onPointerDown={startResize("inspector")}
                >
                    <span className="material-symbols-outlined">chevron_left</span>
                </button>
            )}
            <div
                className={`relative z-[5] col-start-3 row-start-2 cursor-row-resize before:absolute before:inset-x-0 before:top-px before:bottom-px before:bg-transparent before:transition-colors before:duration-150 hover:before:bg-[#2f3a37] light:hover:before:bg-[#b8c8c0] ${resizingRef.current === "analysis" ? "bg-[#3d4b47] light:bg-[#b8c8c0]" : ""} ${analysisOpen ? "" : "hidden"} max-[850px]:hidden`}
                onPointerDown={startResize("analysis")}
            />
            {analysisOpen && (
                <AnalysisPanel
                    analysis={graph.analysis}
                    onClose={() => setAnalysisOpen(false)}
                />
            )}
            {previewNode && (
                <ImagePreview
                    node={previewNode}
                    projectId={projectId}
                    onClose={() => setPreviewNode(null)}
                />
            )}
        </section>
    );
}

export default WorkspaceLayout;
