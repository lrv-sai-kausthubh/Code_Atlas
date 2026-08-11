import { ReactFlowProvider } from "@xyflow/react";
import type { XYPosition } from "@xyflow/react";
import {
  Sparkles,
  Shield,
  BarChart3,
  Minimize2,
  Maximize2,
  ChevronsUpDown,
  ChevronsDownUp,
  Download,
} from "lucide-react";
import GraphCanvas from "../atlas/graph-canvas";
import BackButton from "../back-button";
import ProjectSearch from "./project-search";
import { useNavigation } from "../../services/navigation";
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
  auraOpen,
  onToggleAura,
  onCollapseAll,
  onExpandAll,
  positionOffsets,
  onMoveNodes,
  visibleNodes,
  onBack,
  projectId,
  token,
  layoutDirty,
  onExportLayout,
  renames,
  onRename,
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
  auraOpen: boolean;
  onToggleAura: () => void;
  onCollapseAll: () => void;
  onExpandAll: () => void;
  positionOffsets: ReadonlyMap<string, XYPosition>;
  onMoveNodes: (movements: NodeMovement[]) => void;
  visibleNodes: number;
  onBack: () => void;
  projectId: string;
  token: string;
  layoutDirty: boolean;
  onExportLayout: () => void;
  renames: ReadonlyMap<string, string>;
  onRename: (nodeId: string, label: string) => void;
}) {
  const { navigate } = useNavigation();
  const openSecurity = () => navigate("security", { state: { projectId } });
  const restrictedCount = graph.nodes.filter(
    (node) => node.access && !node.access.source,
  ).length;
  const anyCollapsed = collapsed.size > 0;
  return (
    <div
      className={`${PANEL} relative col-start-3 row-start-1 flex flex-col overflow-hidden max-[850px]:min-h-[600px]`}
    >
      <div className="flex h-[49px] items-center justify-between gap-3 border-b border-[var(--ca-hairline)] px-5 ca-mono-label !text-[10px] ">
        <div className="flex min-w-0 items-center gap-3">
          <BackButton variant="ghost" onClick={onBack} label="BACK" />
        </div>
         <div className="truncate text-[var(--ca-ink)]">
            <span className={LIVE_DOT} /> STRUCTURE MAP{" "}
            <span className="mx-[7px] text-[var(--ca-muted-soft)]">/</span> {visibleNodes} OF{" "}
            {graph.nodes.length} NODES
            {restrictedCount > 0 && (
              <>
                <span className="mx-[7px] text-[var(--ca-muted-soft)]">/</span>{" "}
                <span
                  className="text-[var(--ca-primary)]"
                  title="Dashed, dimmed nodes are visible in the graph but their source is locked by access policy."
                >
                  {restrictedCount} LOCKED
                </span>
              </>
            )}
          </div>
        <div className="flex h-[30px] shrink-0 items-center rounded-[8px] border border-[var(--ca-hairline)] bg-[var(--ca-surface-card)]">
          {graph.is_manager && (
            <>
              <button
                onClick={openSecurity}
                title="Manage access control for this project"
                className="flex h-full items-center gap-1.5 px-[11px] text-[var(--graph-label)] transition-colors hover:bg-[var(--ca-surface-strong)] hover:text-[var(--ca-primary)]"
              >
                <Shield size={13} />
                <span className="ca-mono-label !text-[9px] max-[1150px]:hidden">
                  SECURITY
                </span>
              </button>
              <span className="h-4 w-px shrink-0 bg-[var(--ca-hairline)]" />
            </>
          )}
          <ProjectSearch
            graph={graph}
            projectId={projectId}
            token={token}
            onSelect={onSelect}
          />
          <span className="h-4 w-px shrink-0 bg-[var(--ca-hairline)]" />
          <button
            onClick={onToggleAura}
            title="Talk to Aura 1.0 — your AI architecture copilot"
            className={`flex h-full items-center gap-1.5 px-[11px] transition-colors ${
              auraOpen
                ? "bg-[color-mix(in_srgb,var(--ca-success)_14%,transparent)] text-[var(--ca-success)]"
                : "text-[var(--graph-label)] hover:bg-[var(--ca-surface-strong)] hover:text-[var(--ca-success)]"
            }`}
          >
            <Sparkles size={13} />
            <span className="ca-mono-label !text-[9px] max-[1250px]:hidden">
              {auraOpen ? "HIDE AURA" : "AURA 1.0"}
            </span>
          </button>
          <span className="h-4 w-px shrink-0 bg-[var(--ca-hairline)]" />
          <button
            onClick={onToggleAnalysis}
            title={
              analysisOpen ? "Hide analysis panel" : "Open repository analysis"
            }
            className={`flex h-full items-center gap-1.5 px-[11px] transition-colors ${
              analysisOpen
                ? "bg-[color-mix(in_srgb,var(--ca-primary)_14%,transparent)] text-[var(--ca-primary)]"
                : "text-[var(--graph-label)] hover:bg-[var(--ca-surface-strong)] hover:text-[var(--ca-primary)]"
            }`}
          >
            <BarChart3 size={13} />
            <span className="ca-mono-label !text-[9px] max-[1150px]:hidden">
              {analysisOpen ? "HIDE" : "ANALYSIS"}
            </span>
          </button>
          <span className="h-4 w-px shrink-0 bg-[var(--ca-hairline)]" />
          <button
            onClick={onExportLayout}
            disabled={!layoutDirty}
            title={
              layoutDirty
                ? "Download the modified map layout (positions & renames)"
                : "Drag nodes or rename one (double-click) to enable export"
            }
            className={`flex h-full items-center gap-1.5 px-[11px] transition-colors ${
              layoutDirty
                ? "text-[var(--ca-primary)] hover:bg-[var(--ca-surface-strong)]"
                : "cursor-not-allowed text-[var(--ca-muted-soft)]"
            }`}
          >
            <Download size={13} />
            <span className="ca-mono-label !text-[9px] max-[1150px]:hidden">
              {layoutDirty ? "EXPORT" : "EXPORT"}
              {layoutDirty && (
                <span className="ml-1 text-[var(--ca-success)]">●</span>
              )}
            </span>
          </button>
          <span className="h-4 w-px shrink-0 bg-[var(--ca-hairline)]" />
          <button
            onClick={onToggleCompact}
            title={compact ? "Relax node spacing" : "Tighten node spacing"}
            className={`grid h-full w-[34px] place-items-center transition-colors ${
              compact
                ? "text-[var(--ca-primary)]"
                : "text-[var(--graph-label)] hover:bg-[var(--ca-surface-strong)] hover:text-[var(--ca-primary)]"
            }`}
          >
            {compact ? <Maximize2 size={13} /> : <Minimize2 size={13} />}
          </button>
          <span className="h-4 w-px shrink-0 bg-[var(--ca-hairline)]" />
          <button
            onClick={anyCollapsed ? onExpandAll : onCollapseAll}
            title={anyCollapsed ? "Expand all folders" : "Collapse all folders"}
            className="grid h-full w-[34px] place-items-center text-[var(--graph-label)] transition-colors hover:bg-[var(--ca-surface-strong)] hover:text-[var(--ca-primary)]"
          >
            {anyCollapsed ? (
              <ChevronsDownUp size={13} />
            ) : (
              <ChevronsUpDown size={13} />
            )}
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
          renames={renames}
          onRename={onRename}
        />
      </ReactFlowProvider>
    </div>
  );
}

export default GraphPanel;
