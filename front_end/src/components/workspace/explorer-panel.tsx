import ExplorerTree from "../explorer/explorer-tree";
import type { Key, DropTarget } from "react-aria-components";
import { NODE_COLORS } from "../atlas/atlas-types";
import {
  PANEL,
  PANEL_HEADING,
  PANEL_HEADING_ACTIONS,
  PANEL_COLLAPSE,
  MUTED,
} from "./panel-classes";
import type { AddedFile, ProjectGraph, ProjectNode } from "../../types/project";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  FilePlus2,
  Folder,
  FolderPlus,
  Loader2,
} from "lucide-react";
import { useRef } from "react";

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
  addedFiles,
  removedPaths,
  onAddFiles,
  onAddFolder,
  onDeleteNode,
  onRemoveAdded,
  onExportZip,
  onExportJson,
  exportBusy,
  orderings,
  onReorder,
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
  addedFiles: AddedFile[];
  removedPaths: Set<string>;
  onAddFiles: (files: File[]) => void;
  onAddFolder: (files: File[]) => void;
  onDeleteNode: (node: ProjectNode) => void;
  onRemoveAdded: (path: string) => void;
  onExportZip: () => void;
  onExportJson: () => void;
  exportBusy: boolean;
  orderings: Map<string, string[]>;
  onReorder: (keys: Set<Key>, target: DropTarget) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const changed = addedFiles.length > 0 || removedPaths.size > 0;
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
          <div className="mt-[15px] flex flex-wrap items-center gap-1.5">
            <button
              className="ca-mono-label flex h-8 items-center gap-1.5 rounded-[8px] border border-[var(--ca-hairline)] bg-[var(--ca-surface-card)] px-2.5 text-[9px] text-[var(--ca-body)] transition-colors hover:border-[var(--ca-primary)] hover:text-[var(--ca-primary)]"
              onClick={() => fileInputRef.current?.click()}
              title="Add files from your computer"
            >
              <FilePlus2 size={12} />
              ADD FILES
            </button>
            <button
              className="ca-mono-label flex h-8 items-center gap-1.5 rounded-[8px] border border-[var(--ca-hairline)] bg-[var(--ca-surface-card)] px-2.5 text-[9px] text-[var(--ca-body)] transition-colors hover:border-[var(--ca-primary)] hover:text-[var(--ca-primary)]"
              onClick={() => folderInputRef.current?.click()}
              title="Add a folder from your computer"
            >
              <FolderPlus size={12} />
              ADD FOLDER
            </button>
            <span className="mx-1 h-4 w-px shrink-0 bg-[var(--ca-hairline)]" />
            <button
              className={`ca-mono-label flex h-8 items-center gap-1.5 rounded-[8px] border px-2.5 text-[9px] transition-colors ${
                changed
                  ? "border-[var(--ca-success)]/50 bg-[color-mix(in_srgb,var(--ca-success)_10%,var(--ca-surface-card))] text-[var(--ca-success)] hover:bg-[color-mix(in_srgb,var(--ca-success)_20%,var(--ca-surface-card))]"
                  : "cursor-not-allowed border-[var(--ca-hairline)] text-[var(--ca-muted-soft)]"
              }`}
              onClick={onExportZip}
              disabled={!changed || exportBusy}
              title={
                changed
                  ? "Download the edited project (with your changes) as ZIP"
                  : "Delete files or add local files to enable export"
              }
            >
              {exportBusy ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
              ZIP
            </button>
            <button
              className={`ca-mono-label flex h-8 items-center gap-1.5 rounded-[8px] border px-2.5 text-[9px] transition-colors ${
                changed
                  ? "border-[var(--ca-primary)]/50 bg-[color-mix(in_srgb,var(--ca-primary)_10%,var(--ca-surface-card))] text-[var(--ca-primary)] hover:bg-[color-mix(in_srgb,var(--ca-primary)_20%,var(--ca-surface-card))]"
                  : "cursor-not-allowed border-[var(--ca-hairline)] text-[var(--ca-muted-soft)]"
              }`}
              onClick={onExportJson}
              disabled={!changed || exportBusy}
              title={
                changed
                  ? "Download the edited project graph (with your changes) as JSON"
                  : "Delete files or add local files to enable export"
              }
            >
              <Download size={12} />
              JSON
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            hidden
            onChange={(event) => {
              const files = Array.from(event.target.files ?? []);
              if (files.length) onAddFiles(files);
              event.target.value = "";
            }}
          />
          <input
            ref={folderInputRef}
            type="file"
            multiple
            hidden
            {...{ webkitdirectory: "", directory: "" }}
            onChange={(event) => {
              const files = Array.from(event.target.files ?? []);
              if (files.length) onAddFolder(files);
              event.target.value = "";
            }}
          />
          <div className="no-scrollbar mt-[15px] max-h-[calc(100vh-330px)] overflow-y-auto pr-0.5 max-[850px]:max-h-[180px]">
            <ExplorerTree
              graph={graph}
              query={query}
              selected={selected}
              collapsed={collapsed}
              onSelect={onSelect}
              onToggle={onToggle}
              addedFiles={addedFiles}
              removedPaths={removedPaths}
              onDeleteNode={onDeleteNode}
              onRemoveAdded={onRemoveAdded}
              orderings={orderings}
              onReorder={onReorder}
            />
          </div>
        </>
      )}
    </aside>
  );
}

export default ExplorerPanel;