import { fileIcon, formatBytes, isPreviewable } from "../atlas/file-utils";
import { NODE_COLORS } from "../atlas/atlas-types";
import {
    PANEL,
    PANEL_HEADING,
    PANEL_HEADING_ACTIONS,
    PANEL_COLLAPSE,
    MUTED,
} from "./panel-classes";
import type { ProjectGraph, ProjectNode } from "../../types/project";

function InspectorPanel({
    graph,
    selected,
    projectId,
    inspectorCollapsed,
    onToggleCollapse,
    onOpenPreview,
}: {
    graph: ProjectGraph;
    selected: ProjectNode | null;
    projectId: string;
    inspectorCollapsed: boolean;
    onToggleCollapse: () => void;
    onOpenPreview: (node: ProjectNode) => void;
}) {
    return (
        <aside className={`${PANEL} relative overflow-hidden px-4 py-5 col-start-5 row-start-1 max-[850px]:order-3 max-[850px]:min-h-[300px]`}>
            <div className={PANEL_HEADING}>
                <span>INSPECTOR</span>
                <div className={PANEL_HEADING_ACTIONS}>
                    <span className={MUTED}>
                        {selected ? selected.type.toUpperCase() : "NONE"}
                    </span>
                    <button
                        className={PANEL_COLLAPSE}
                        onClick={onToggleCollapse}
                        aria-label={inspectorCollapsed ? "Expand inspector" : "Collapse inspector"}
                    >
                        <span className="material-symbols-outlined">
                            {inspectorCollapsed ? "chevron_left" : "chevron_right"}
                        </span>
                    </button>
                </div>
            </div>
            {!inspectorCollapsed && (
                <>
                    {selected ? (
                        <>
                            <div className="mx-[-16px] grid grid-cols-3 border-y border-[#2b3030] light:border-[#d6dfda]" style={{ marginTop: 23, marginBottom: 25 }}>
                                <div className="border-r border-[#2b3030] px-[3px] py-3 text-center light:border-[#d6dfda]">
                                    <strong>{graph.files}</strong>
                                    <span>FILES</span>
                                </div>
                                <div className="border-r border-[#2b3030] px-[3px] py-3 text-center light:border-[#d6dfda]">
                                    <strong>{graph.folders}</strong>
                                    <span>FOLDERS</span>
                                </div>
                                <div className="px-[3px] py-3 text-center">
                                    <strong>{Object.keys(graph.languages).length}</strong>
                                    <span>LANGUAGES</span>
                                </div>
                            </div>
                            <div
                                className="mt-3 text-[45px]"
                                style={{ color: NODE_COLORS[selected.type] }}
                            >
                                <span className="material-symbols-outlined">
                                    {selected.type === "file"
                                        ? fileIcon(selected.label).name
                                        : selected.type === "folder"
                                            ? "folder"
                                            : "account_tree"}
                                </span>
                            </div>
                            <h2 className="my-[5px] text-[20px] [overflow-wrap:anywhere]">
                                {selected.label}
                            </h2>
                            <p className="font-dm text-[11px] leading-[1.5] text-[#6d7974] [overflow-wrap:anywhere] light:text-[#61716a]">
                                {selected.path || "/"}
                            </p>
                            <div className="flex flex-col gap-1.5 border-t border-[#2c3331] py-[13px] light:border-[#d6dfda]">
                                <span className="font-dm text-[9px] text-[#5d6964]">
                                    NODE TYPE
                                </span>
                                <strong className="font-dm text-[11px] text-[#b9c1bd]">
                                    {selected.type}
                                </strong>
                            </div>
                            {selected.language && (
                                <div className="flex flex-col gap-1.5 border-t border-[#2c3331] py-[13px] light:border-[#d6dfda]">
                                    <span className="font-dm text-[9px] text-[#5d6964]">
                                        LANGUAGE
                                    </span>
                                    <strong className="font-dm text-[11px] text-[#b9c1bd]">
                                        {selected.language}
                                    </strong>
                                </div>
                            )}
                            {selected.type === "file" && (
                                <>
                                    <div className="flex flex-col gap-1.5 border-t border-[#2c3331] py-[13px] light:border-[#d6dfda]">
                                        <span className="font-dm text-[9px] text-[#5d6964]">
                                            LINES
                                        </span>
                                        <strong className="font-dm text-[11px] text-[#b9c1bd]">
                                            {selected.lines?.toLocaleString() ?? "-"}
                                        </strong>
                                    </div>
                                    <div className="flex flex-col gap-1.5 border-t border-[#2c3331] py-[13px] light:border-[#d6dfda]">
                                        <span className="font-dm text-[9px] text-[#5d6964]">
                                            SIZE
                                        </span>
                                        <strong className="font-dm text-[11px] text-[#b9c1bd]">
                                            {selected.size_bytes === undefined
                                                ? "-"
                                                : formatBytes(selected.size_bytes)}
                                        </strong>
                                    </div>
                                </>
                            )}
                            <div className="flex flex-col gap-1.5 border-t border-[#2c3331] py-[13px] light:border-[#d6dfda]">
                                <span className="font-dm text-[9px] text-[#5d6964]">
                                    RELATIONSHIP
                                </span>
                                <strong className="font-dm text-[11px] text-[#b9c1bd]">
                                    CONTAINS / IMPORTS
                                </strong>
                            </div>
                            {projectId && isPreviewable(selected) && (
                                <button
                                    className="mt-[14px] flex w-full items-center justify-center gap-2 border border-[var(--graph-edge)] bg-[var(--graph-surface)] px-[10px] py-2 font-dm text-[9px] tracking-[.08em] text-[var(--graph-label)] transition-colors hover:border-[#f2b84b] hover:text-[#f2b84b] light:bg-[#f6f8f5]"
                                    onClick={() => onOpenPreview(selected)}
                                >
                                    <span className="material-symbols-outlined text-[16px]">visibility</span>
                                    OPEN PREVIEW
                                </button>
                            )}
                        </>
                    ) : (
                        <p className="mt-[50px] font-dm text-xs leading-[1.6] text-[#6f7975] light:text-[#61716a]">
                            Select a node in the map to see its details.
                        </p>
                    )}
                </>
            )}
        </aside>
    );
}

export default InspectorPanel;
