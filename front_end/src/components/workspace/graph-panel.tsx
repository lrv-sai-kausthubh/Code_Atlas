import { ReactFlowProvider } from "@xyflow/react";
import type { XYPosition } from "@xyflow/react";
import GraphCanvas from "../atlas/graph-canvas";
import { LIVE_DOT, PANEL } from "./panel-classes";
import type { ProjectGraph, ProjectNode } from "../../types/project";
import type { NodeMovement } from "../atlas/atlas-types";

function GraphPanel({
    graph,
    collapsed,
    selected,
    focusNodeId,
    onSelect,
    onToggle,
    compact,
    onToggleCompact,
    analysisOpen,
    onToggleAnalysis,
    onCollapseAll,
    onExpandAll,
    positionOffsets,
    onMoveNodes,
    visibleNodes,
}: {
    graph: ProjectGraph;
    collapsed: Set<string>;
    selected: ProjectNode | null;
    focusNodeId: string | null;
    onSelect: (node: ProjectNode) => void;
    onToggle: (nodeId: string) => void;
    compact: boolean;
    onToggleCompact: () => void;
    analysisOpen: boolean;
    onToggleAnalysis: () => void;
    onCollapseAll: () => void;
    onExpandAll: () => void;
    positionOffsets: ReadonlyMap<string, XYPosition>;
    onMoveNodes: (movements: NodeMovement[]) => void;
    visibleNodes: number;
}) {
    return (
        <div className={`${PANEL} relative col-start-3 row-start-1 flex flex-col overflow-hidden max-[850px]:min-h-[600px]`}>
            <div className="flex h-[49px] items-center justify-between border-b border-[#2b3030] px-5 font-dm text-[10px] tracking-[.1em] text-[#79817e] light:border-[#d6dfda]">
                <div className="text-[#b1bab5] light:text-[#202824]">
                    <span className={LIVE_DOT} /> STRUCTURE MAP{" "}
                    <span className="mx-[7px] text-[#46504d]">/</span>{" "}
                    {visibleNodes} OF {graph.nodes.length} NODES
                </div>
                <div className="flex items-center gap-[5px]">
                    <button
                        className={`border border-[var(--graph-edge)] bg-[var(--graph-surface)] px-2 py-[6px] font-dm text-[9px] tracking-[.02em] text-[var(--graph-label)] transition-colors hover:border-[#f2b84b] hover:text-[#f2b84b] light:border-[#b8c8c0] light:bg-[#f6f8f5] light:text-[#405149] light:hover:bg-[#e3ece7] ${analysisOpen ? "border-[#f2b84b] text-[#f2b84b] light:bg-[#e3ece7]" : ""}`}
                        onClick={onToggleAnalysis}
                    >
                        {analysisOpen ? "HIDE ANALYSIS" : "ANALYSIS"}
                    </button>
                    <button
                        className={`border border-[var(--graph-edge)] bg-[var(--graph-surface)] px-2 py-[6px] font-dm text-[9px] tracking-[.02em] text-[var(--graph-label)] transition-colors hover:border-[#f2b84b] hover:text-[#f2b84b] light:border-[#b8c8c0] light:bg-[#f6f8f5] light:text-[#405149] light:hover:bg-[#e3ece7] ${compact ? "border-[#f2b84b] text-[#f2b84b] light:bg-[#e3ece7]" : ""}`}
                        onClick={onToggleCompact}
                    >
                        {compact ? "RELAX" : "TIGHTEN"}
                    </button>
                    <button
                        className="border border-[var(--graph-edge)] bg-[var(--graph-surface)] px-2 py-[6px] font-dm text-[9px] tracking-[.02em] text-[var(--graph-label)] transition-colors hover:border-[#f2b84b] hover:text-[#f2b84b] light:border-[#b8c8c0] light:bg-[#f6f8f5] light:text-[#405149] light:hover:bg-[#e3ece7]"
                        onClick={onCollapseAll}
                    >
                        COLLAPSE ALL
                    </button>
                    <button
                        className="border border-[var(--graph-edge)] bg-[var(--graph-surface)] px-2 py-[6px] font-dm text-[9px] tracking-[.02em] text-[var(--graph-label)] transition-colors hover:border-[#f2b84b] hover:text-[#f2b84b] light:border-[#b8c8c0] light:bg-[#f6f8f5] light:text-[#405149] light:hover:bg-[#e3ece7]"
                        onClick={onExpandAll}
                    >
                        EXPAND ALL
                    </button>
                </div>
            </div>
            <ReactFlowProvider>
                <GraphCanvas
                    graph={graph}
                    collapsed={collapsed}
                    selected={selected}
                    focusNodeId={focusNodeId}
                    onSelect={onSelect}
                    onToggle={onToggle}
                    compact={compact}
                    positionOffsets={positionOffsets}
                    onMoveNodes={onMoveNodes}
                />
            </ReactFlowProvider>
        </div>
    );
}

export default GraphPanel;
