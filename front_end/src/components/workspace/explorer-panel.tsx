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
import { ChevronLeft, ChevronRight, File, Folder } from "lucide-react";
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
        <span>PROJECT EXPLORER</span>
        <div className={PANEL_HEADING_ACTIONS}>
          <span className={MUTED}>{graph.files} FILES</span>
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
          <div className="flex justify-between items-center my-[30px] font-dm text-[13px] text-[#f2b84b]">
            <div className="flex gap-2 items-center">
              {" "}
              <Folder />
              {graph.project}
            </div>
            <div className="flex gap-[11px] font-dm text-[9px] text-[#59635f] light:text-[#687870] max-[850px]:hidden">
              
              <span className="flex gap-1 items-center">
                <File className="inline-block h-2.5 w-3.5 rounded-full" style={{ color: NODE_COLORS.file }} />
                FILE
              </span>
              <span className="flex gap-1 items-center">
                <Folder className="inline-block h-2.5 w-3.5 rounded-full" style={{ color: NODE_COLORS.folder }} />
                FOLDER
              </span>
            </div>
          </div>
          <input
            className="w-full border border-[#303636] bg-[#111313] px-[10px] py-[9px] font-dm text-[11px] text-[#dfe5df] outline-none focus:border-[#64d5c4] light:border-[#ccd8d1] light:bg-[#edf2ee] light:text-[#202824]"
            placeholder="Filter files..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <div className="no-scrollbar mt-[15px] max-h-[calc(100vh-250px)] overflow-y-auto pr-0.5 max-[850px]:max-h-[180px]">
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
