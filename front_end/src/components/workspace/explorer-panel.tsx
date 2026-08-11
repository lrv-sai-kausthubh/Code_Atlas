import ExplorerTree from "../explorer/explorer-tree";
import { NODE_COLORS } from "../atlas/atlas-types";
import {
  PANEL,
  PANEL_HEADING,
  PANEL_HEADING_ACTIONS,
  PANEL_COLLAPSE,
  MUTED,
} from "./panel-classes";
import type { ProjectGraph, ProjectNode } from "../../types/project";
import { ChevronLeft, ChevronRight, Folder } from "lucide-react";
function ExplorerPanel({
  graph,
  query,
  setQuery,
  selected,
  collapsed,
  onSelect,
  onToggle,
  explorerCollapsed,
  onToggleCollapse,
}: {
  graph: ProjectGraph;
  query: string;
  setQuery: (query: string) => void;
  selected: ProjectNode | null;
  collapsed: Set<string>;
  onSelect: (node: ProjectNode) => void;
  onToggle: (nodeId: string) => void;
  explorerCollapsed: boolean;
  onToggleCollapse: () => void;
}) {
  return (
    <aside
      className={`${PANEL} relative overflow-hidden overflow-y-auto no-scrollbar px-4 py-5 col-start-1 row-start-1 max-[850px]:order-2 max-[850px]:min-h-[220px]`}
    >
      <div className={PANEL_HEADING}>
        <span>Project explorer</span>
        <div className={PANEL_HEADING_ACTIONS}>
          <span className={MUTED}>{graph.files} files</span>
          <button
            className={PANEL_COLLAPSE}
            onClick={onToggleCollapse}
            aria-label={
              explorerCollapsed ? "Expand explorer" : "Collapse explorer"
            }
          >
            {explorerCollapsed ? (
              <ChevronRight size={16} />
            ) : (
              <ChevronLeft size={16} />
            )}
          </button>
        </div>
      </div>
      {!explorerCollapsed && (
        <>
          <div className="my-[22px] flex items-center justify-between">
            <div className="flex items-center gap-2 text-[13px] font-medium text-[var(--ca-ink)]">
              <Folder size={14} strokeWidth={1.8} />
              {graph.project}
            </div>
            <div className="ca-mono-label hidden gap-3 text-[9px] max-[850px]:hidden">
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-full" style={{ background: NODE_COLORS.file }} />
                FILE
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-full" style={{ background: NODE_COLORS.folder }} />
                FOLDER
              </span>
            </div>
          </div>
          <input
            className="ca-input h-9 !rounded-[8px] !px-3 font-mono text-[12px]"
            placeholder="Filter files…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <div className="no-scrollbar mt-[15px] max-h-[calc(100vh-260px)] overflow-y-auto pr-0.5 max-[850px]:max-h-[180px]">
            <ExplorerTree
              graph={graph}
              query={query}
              selected={selected}
              collapsed={collapsed}
              onSelect={onSelect}
              onToggle={onToggle}
            />
          </div>
        </>
      )}
    </aside>
  );
}

export default ExplorerPanel;