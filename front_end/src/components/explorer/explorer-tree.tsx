import type { ReactNode } from "react";
import { Folder, FolderOpen, Lock } from "lucide-react";
import type { ProjectGraph, ProjectNode } from "../../types/project";
import { fileIcon } from "../atlas/file-utils";

function ExplorerTree({
    graph,
    query,
    selected,
    collapsed,
    onSelect,
    onToggle,
}: {
    graph: ProjectGraph;
    query: string;
    selected: ProjectNode | null;
    collapsed: Set<string>;
    onSelect: (node: ProjectNode) => void;
    onToggle: (nodeId: string) => void;
}) {
    const children = new Map<string, ProjectNode[]>();
    graph.edges
        .filter((edge) => edge.relation !== "IMPORTS")
        .forEach((edge) => {
            const child = graph.nodes.find((node) => node.id === edge.target);
            if (child)
                children.set(edge.source, [
                    ...(children.get(edge.source) ?? []),
                    child,
                ]);
        });
    const renderNode = (node: ProjectNode, depth: number): ReactNode => {
        const isFolder = node.type === "folder";
        const restricted = node.type === "file" && node.access?.source === false;
        const icon = isFolder
            ? {
                Icon: collapsed.has(node.id) ? Folder : FolderOpen,
                className: "text-[#64d5c4]",
            }
            : fileIcon(node.label);
        return (
            <div key={node.id}>
                <button
                    className={`min-h-[28px] w-full flex items-center gap-2 border-0 bg-transparent px-1 py-[5px] text-left font-dm text-[11px] text-[#969f9b] transition-colors hover:bg-[#242d2b] hover:text-[#f1f3ed] light:text-[#56645e] light:hover:bg-[#e3ece7] light:hover:text-[#202824] ${selected?.id === node.id ? "bg-[#242d2b] text-[#f1f3ed] light:bg-[#e3ece7] light:text-[#202824]" : ""} ${restricted ? "opacity-60" : ""}`}
                    style={{ paddingLeft: `${4 + depth * 14}px` }}
                    onClick={() => {
                        onSelect(node);
                        if (isFolder) onToggle(node.id);
                    }}
                >
                    <span className={`flex-[0_0_24px] w-6 text-center font-dm text-[10px] font-medium ${icon.className}`}>
                        <icon.Icon size={18} strokeWidth={1.8} className="inline" />
                    </span>
                    <span className="min-w-0 truncate">{node.label}</span>
                    {restricted && (
                        <Lock className="shrink-0 text-[#f2b84b]" size={12} aria-label="Restricted — metadata only" />
                    )}
                    <small className="ml-auto shrink-0 text-[8px] text-[#4f5d59] light:text-[#687870]">
                        {node.type}
                    </small>
                </button>
                {isFolder &&
                    !collapsed.has(node.id) &&
                    (children.get(node.id) ?? []).map((child) =>
                        renderNode(child, depth + 1),
                    )}
            </div>
        );
    };
    if (query)
        return (
            <>
                {graph.nodes
                    .filter(
                        (node) =>
                            node.label.toLowerCase().includes(query.toLowerCase()) &&
                            node.id !== "root",
                    )
                    .map((node) => renderNode(node, 0))}
            </>
        );
    return <>{(children.get("root") ?? []).map((node) => renderNode(node, 0))}</>;
}

export default ExplorerTree;
