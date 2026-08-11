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
                className: "text-[var(--ca-muted)]",
            }
            : fileIcon(node.label);
        return (
            <div key={node.id}>
                <button
                    className={`min-h-[28px] w-full flex items-center gap-2 border-0 border-r-2 bg-transparent px-1 py-[5px] text-left font-mono text-[11px] text-[var(--ca-body)] transition-colors hover:bg-[var(--ca-surface-strong)] hover:text-[var(--ca-ink)] ${selected?.id === node.id ? "border-r-[var(--ca-primary)] bg-[var(--ca-surface-strong)] text-[var(--ca-ink)]" : "border-r-transparent"} ${restricted ? "opacity-60" : ""}`}
                    style={{ paddingLeft: `${4 + depth * 14}px` }}
                    onClick={() => {
                        onSelect(node);
                        if (isFolder) onToggle(node.id);
                    }}
                >
                    <span className={`flex-[0_0_24px] w-6 text-center font-mono text-[10px] font-medium ${icon.className}`}>
                        <icon.Icon size={18} strokeWidth={1.8} className="inline" />
                    </span>
                    <span className="min-w-0 truncate">{node.label}</span>
                    {restricted && (
                        <Lock className="shrink-0 text-[var(--ca-error)]" size={12} aria-label="Restricted — metadata only" />
                    )}
                    <small className="ca-mono-label ml-auto shrink-0 text-[8px]">
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
