import { MarkerType } from "@xyflow/react";
import type { Edge, XYPosition } from "@xyflow/react";
import type { ProjectGraph, ProjectNode } from "../../types/project";
import type { AtlasNode } from "./atlas-types";

export function makeLayout(
    graph: ProjectGraph,
    onSelect: (node: ProjectNode) => void,
    onToggle: (nodeId: string) => void,
    compact: boolean,
    positionOffsets: ReadonlyMap<string, XYPosition>,
    focusedNodeId: string | null,
) {
    const children = new Map<string, string[]>();
    graph.edges
        .filter((edge) => edge.relation !== "IMPORTS")
        .forEach((edge) => {
            const group = children.get(edge.source) ?? [];
            group.push(edge.target);
            children.set(edge.source, group);
        });
    const nodesById = new Map(graph.nodes.map((node) => [node.id, node]));
    const widths = new Map<string, number>();
    const measure = (nodeId: string): number => {
        const childIds = children.get(nodeId) ?? [];
        const width = childIds.length
            ? childIds.reduce((sum, childId) => sum + measure(childId), 0)
            : 1;
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
        nodes.push({
            id: node.id,
            type: "atlas",
            position: {
                x: center * (compact ? 112 : 150) + offset.x,
                y: depth * (compact ? 122 : 160) + offset.y,
            },
            data: { ...node, onSelect, onToggle, selected: false, focused: node.id === focusedNodeId },
        });
        let childStart = start;
        childIds.forEach((childId) => {
            place(childId, depth + 1, childStart);
            childStart += widths.get(childId) ?? 1;
        });
    };
    place("root", 0, -(widths.get("root") ?? 1) / 2);

    const cycleNodes = new Set(
        graph.analysis.circular_dependencies.flatMap((cycle) =>
            cycle.map((path) => `file:${path}`),
        ),
    );
    const edges: Edge[] = graph.edges.map((edge) => {
        const isImport = edge.relation === "IMPORTS";
        const isCycle =
            isImport && cycleNodes.has(edge.source) && cycleNodes.has(edge.target);
        const edgeColor = isCycle
            ? "var(--cycle-edge)"
            : isImport
                ? "var(--import-edge)"
                : "var(--graph-edge)";
        return {
            id: edge.id,
            source: edge.source,
            target: edge.target,
            type: isImport ? "bezier" : "smoothstep",
            animated: isImport,
            label: isCycle ? "CYCLE" : isImport ? "IMPORTS" : undefined,
            markerEnd: isImport
                ? { type: MarkerType.ArrowClosed, color: edgeColor }
                : undefined,
            style: {
                stroke: edgeColor,
                strokeWidth: isImport ? 1.8 : 1.2,
                strokeDasharray: isImport ? "5 4" : undefined,
            },
            labelStyle: {
                fill: "var(--graph-label)",
                fontSize: 8,
                fontFamily: "DM Mono, monospace",
            },
            labelBgStyle: { fill: "var(--graph-surface)", fillOpacity: 0.9 },
        };
    });
    return { nodes, edges };
}
