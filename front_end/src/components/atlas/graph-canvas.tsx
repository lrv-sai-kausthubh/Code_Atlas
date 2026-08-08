import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DragEvent } from "react";
import {
    applyNodeChanges,
    Background,
    Controls,
    MiniMap,
    ReactFlow,
    SelectionMode,
    useEdgesState,
    useNodesState,
    useReactFlow,
    useViewport,
} from "@xyflow/react";
import type { NodeChange, OnNodeDrag, XYPosition } from "@xyflow/react";
import type { ProjectGraph, ProjectNode } from "../../types/project";
import { AtlasNodeView, ImageNodeView } from "./atlas-node";
import { NODE_COLORS } from "./atlas-types";
import type {
    AtlasNode,
    AtlasNodeData,
    ImageAtlasNode,
    ImageNodeData,
    NodeMovement,
} from "./atlas-types";
import { makeLayout } from "./graph-layout";

const nodeTypes = { atlas: AtlasNodeView, image: ImageNodeView };

export const IMAGE_DROP_MIME = "application/x-codeatlas-image";

function ZoomBadge() {
    const { zoom } = useViewport();
    return (
        <div className="absolute top-[14px] right-[160px] z-[5] font-dm text-[10px] text-[var(--graph-label)] max-[850px]:right-[126px]">
            {Math.round(zoom * 100)}%
        </div>
    );
}

export type ImageDropPayload = {
    src: string;
    node: ProjectNode;
};

function GraphCanvas({
    graph,
    collapsed,
    selected,
    onSelect,
    onToggle,
    focusNodeId,
    compact,
    positionOffsets,
    onMoveNodes,
}: {
    graph: ProjectGraph;
    collapsed: Set<string>;
    selected: ProjectNode | null;
    onSelect: (node: ProjectNode) => void;
    onToggle: (nodeId: string) => void;
    focusNodeId: string | null;
    compact: boolean;
    positionOffsets: ReadonlyMap<string, XYPosition>;
    onMoveNodes: (movements: NodeMovement[]) => void;
}) {
    const { fitView, zoomIn, zoomOut, screenToFlowPosition } = useReactFlow();
    const parentById = useMemo(() => {
        const parents = new Map<string, string>();
        graph.edges
            .filter((edge) => edge.relation !== "IMPORTS")
            .forEach((edge) => parents.set(edge.target, edge.source));
        return parents;
    }, [graph]);
    const hiddenIds = useMemo(() => {
        const hidden = new Set<string>();
        graph.nodes.forEach((node) => {
            let parent = parentById.get(node.id);
            while (parent) {
                if (collapsed.has(parent)) {
                    hidden.add(node.id);
                    break;
                }
                parent = parentById.get(parent);
            }
        });
        return hidden;
    }, [collapsed, graph.nodes, parentById]);
    const initial = useMemo(
        () => makeLayout(graph, onSelect, onToggle, compact, positionOffsets, focusNodeId),
        [compact, focusNodeId, graph, onSelect, onToggle, positionOffsets],
    );
    const [nodes, setNodes] = useNodesState<AtlasNode>(initial.nodes);
    const [imageNodes, setImageNodes] = useState<ImageAtlasNode[]>([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initial.edges);
    const [isDragging, setIsDragging] = useState(false);
    const [isDragOver, setIsDragOver] = useState(false);
    const hasFittedInitialView = useRef(false);
    const previousCompact = useRef(compact);
    const nodesRef = useRef(nodes);
    const dragStart = useRef<Map<string, XYPosition>>(new Map());

    useEffect(() => {
        nodesRef.current = nodes;
    }, [nodes]);

    useEffect(() => {
        const frame = requestAnimationFrame(() => {
            if (!hasFittedInitialView.current) {
                fitView({ padding: 0.18, duration: 350 });
                hasFittedInitialView.current = true;
            }
        });
        return () => cancelAnimationFrame(frame);
    }, [fitView]);

    useEffect(() => {
        if (!focusNodeId || !graph.nodes.some((node) => node.id === focusNodeId)) return;
        const frame = requestAnimationFrame(() => {
            fitView({ nodes: [{ id: focusNodeId }], padding: 1.8, duration: 550, maxZoom: 1.35 });
        });
        return () => cancelAnimationFrame(frame);
    }, [fitView, focusNodeId, graph.nodes]);

    useEffect(() => {
        const reflow = previousCompact.current !== compact;
        previousCompact.current = compact;
        setNodes((currentNodes) => {
            const currentById = new Map(currentNodes.map((node) => [node.id, node]));
            return initial.nodes.map((node) => {
                const existing = currentById.get(node.id);
                const nextNode =
                    existing && !reflow ? { ...node, position: existing.position } : node;
                return { ...nextNode, hidden: hiddenIds.has(node.id) };
            });
        });
        setEdges(
            initial.edges.map((edge) => ({
                ...edge,
                hidden: hiddenIds.has(edge.source) || hiddenIds.has(edge.target),
            })),
        );
    }, [compact, hiddenIds, initial, setEdges, setNodes]);

    useEffect(() => {
        setNodes((currentNodes) => {
            let changed = false;
            const nextNodes = currentNodes.map((node) => {
                const isSelected = node.id === selected?.id;
                if (node.data.selected === isSelected) return node;
                changed = true;
                return { ...node, data: { ...node.data, selected: isSelected } };
            });
            return changed ? nextNodes : currentNodes;
        });
    }, [selected?.id, setNodes]);

    const descendantsById = useMemo(() => {
        const descendants = new Map<string, Set<string>>();
        graph.nodes.forEach((ancestor) => {
            const members = new Set<string>();
            graph.nodes.forEach((candidate) => {
                let parent = parentById.get(candidate.id);
                while (parent) {
                    if (parent === ancestor.id) {
                        members.add(candidate.id);
                        break;
                    }
                    parent = parentById.get(parent);
                }
            });
            descendants.set(ancestor.id, members);
        });
        return descendants;
    }, [graph.nodes, parentById]);

    const onNodesChange = useCallback(
        (changes: NodeChange<AtlasNode | ImageAtlasNode>[]) => {
            const imageChanges = changes.filter(
                (change) => "id" in change && imageNodes.some((node) => node.id === change.id),
            );
            const layoutChanges = changes.filter(
                (change) => !("id" in change) || !imageNodes.some((node) => node.id === change.id),
            );
            if (imageChanges.length) {
                setImageNodes((current) =>
                    applyNodeChanges(imageChanges as NodeChange<ImageAtlasNode>[], current),
                );
            }
            const currentNodes = nodesRef.current;
            const nextNodes = applyNodeChanges(
                layoutChanges as NodeChange<AtlasNode>[],
                currentNodes,
            );
            const movedAncestors = layoutChanges
                .filter((change) => change.type === "position")
                .flatMap((change) => {
                    const before = currentNodes.find((node) => node.id === change.id);
                    const after = nextNodes.find((node) => node.id === change.id);
                    if (
                        !before ||
                        !after ||
                        (before.position.x === after.position.x &&
                            before.position.y === after.position.y)
                    )
                        return [];
                    const delta = {
                        x: after.position.x - before.position.x,
                        y: after.position.y - before.position.y,
                    };
                    return before.data.type === "folder" ||
                        before.data.type === "project"
                        ? [{ id: change.id, delta }]
                        : [];
                });
            const changedPositionIds = new Set(
                layoutChanges
                    .filter((change) => change.type === "position")
                    .map((change) => change.id),
            );
            const descendantMovement = new Map<string, XYPosition>();
            movedAncestors.forEach(({ id, delta }) => {
                descendantsById.get(id)?.forEach((descendantId) => {
                    const currentDelta = descendantMovement.get(descendantId) ?? {
                        x: 0,
                        y: 0,
                    };
                    descendantMovement.set(descendantId, {
                        x: currentDelta.x + delta.x,
                        y: currentDelta.y + delta.y,
                    });
                });
            });
            const translatedNodes = descendantMovement.size
                ? nextNodes.map((node) => {
                    if (changedPositionIds.has(node.id)) return node;
                    const delta = descendantMovement.get(node.id);
                    return delta
                        ? {
                            ...node,
                            position: {
                                x: node.position.x + delta.x,
                                y: node.position.y + delta.y,
                            },
                        }
                        : node;
                })
                : nextNodes;
            nodesRef.current = translatedNodes;
            setNodes(translatedNodes);
        },
        [descendantsById, imageNodes, setNodes],
    );

    const onNodeDragStart: OnNodeDrag<AtlasNode | ImageAtlasNode> = useCallback(
        (_, _node, draggedNodes) => {
            setIsDragging(true);
            dragStart.current = new Map(
                draggedNodes.map((draggedNode) => [
                    draggedNode.id,
                    { ...draggedNode.position },
                ]),
            );
        },
        [],
    );

    const onNodeDragStop: OnNodeDrag<AtlasNode | ImageAtlasNode> = useCallback(
        (_, _node, draggedNodes) => {
            const starts = dragStart.current;
            dragStart.current = new Map();
            setIsDragging(false);
            const movements = draggedNodes.flatMap((draggedNode) => {
                const start = starts.get(draggedNode.id);
                if (!start) return [];
                const delta = {
                    x: draggedNode.position.x - start.x,
                    y: draggedNode.position.y - start.y,
                };
                return delta.x || delta.y ? [{ id: draggedNode.id, delta }] : [];
            });
            const layoutMovements = movements.filter((movement) =>
                nodesRef.current.some((node) => node.id === movement.id),
            );
            if (layoutMovements.length) onMoveNodes(layoutMovements);
        },
        [onMoveNodes],
    );

    const onDragOver = useCallback((event: DragEvent) => {
        if (event.dataTransfer.types.includes(IMAGE_DROP_MIME)) {
            event.preventDefault();
            event.dataTransfer.dropEffect = "copy";
            setIsDragOver(true);
        }
    }, []);

    const onDrop = useCallback(
        (event: DragEvent) => {
            event.preventDefault();
            setIsDragOver(false);
            const raw = event.dataTransfer.getData(IMAGE_DROP_MIME);
            if (!raw) return;
            try {
                const payload = JSON.parse(raw) as ImageDropPayload;
                const position = screenToFlowPosition({
                    x: event.clientX,
                    y: event.clientY,
                });
                const imageNode: ImageAtlasNode = {
                    id: `image-${Date.now()}`,
                    type: "image",
                    position,
                    data: { src: payload.src, node: payload.node, onSelect },
                };
                setImageNodes((current) => [...current, imageNode]);
            } catch {
                // ignore malformed payload
            }
        },
        [onSelect, screenToFlowPosition],
    );

    const combinedNodes = [...nodes, ...imageNodes];

    return (
        <div
            className="relative min-h-0 flex-1 bg-[var(--graph-surface)]"
            onDragOver={onDragOver}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={onDrop}
        >
            <ReactFlow
                nodes={combinedNodes}
                edges={edges}
                nodeTypes={nodeTypes}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onNodeDragStart={onNodeDragStart}
                onNodeDragStop={onNodeDragStop}
                onNodeClick={(_, node) => {
                    if (node.type === "image") {
                        onSelect((node.data as ImageNodeData).node);
                    } else {
                        onSelect(node.data as AtlasNodeData);
                        if ((node.data as AtlasNodeData).type === "folder") onToggle(node.id);
                    }
                }}
                nodesDraggable
                nodesConnectable={false}
                selectionOnDrag
                selectionMode={SelectionMode.Partial}
                panOnDrag={[1, 2]}
                onlyRenderVisibleElements
                minZoom={0.08}
                maxZoom={2.5}
                proOptions={{ hideAttribution: true }}
            >
                <Background color="var(--graph-grid)" gap={28} size={1} />
                <Controls showInteractive={false} />
                {!isDragging && (
                    <MiniMap
                        nodeColor={(node) =>
                            node.type === "image"
                                ? "#9ca9ff"
                                : NODE_COLORS[(node.data as AtlasNodeData).type]
                        }
                        maskColor="var(--minimap-mask)"
                        pannable
                        zoomable
                    />
                )}
            </ReactFlow>
            {isDragOver && (
                <div className="pointer-events-none absolute inset-3 z-[7] flex items-center justify-center border-2 border-dashed border-[#64d5c4] bg-[#64d5c41f] font-dm text-[11px] tracking-[.1em] text-[#64d5c4]">
                    DROP IMAGE TO ADD AS A NODE
                </div>
            )}
            <div className="pointer-events-none absolute bottom-3 left-5 z-[5] font-dm text-[9px] text-[#56615c] light:text-[#687870]">
                DRAG ON CANVAS TO LASSO <span>·</span> MIDDLE-CLICK TO PAN{" "}
                <span>·</span> DRAG NODES
            </div>
            <ZoomBadge />
            <div className="absolute top-[10px] right-5 z-[6] flex gap-1.5">
                <button className="border border-[var(--graph-edge)] bg-[var(--graph-surface)] px-[9px] py-[6px] font-dm text-[10px] text-[var(--graph-label)] transition-colors hover:border-[#f2b84b] hover:text-[#f2b84b] light:border-[#b8c8c0] light:bg-[#f6f8f5] light:text-[#405149] light:hover:bg-[#e3ece7]" onClick={() => zoomIn({ duration: 200 })}>
                    +
                </button>
                <button className="border border-[var(--graph-edge)] bg-[var(--graph-surface)] px-[9px] py-[6px] font-dm text-[10px] text-[var(--graph-label)] transition-colors hover:border-[#f2b84b] hover:text-[#f2b84b] light:border-[#b8c8c0] light:bg-[#f6f8f5] light:text-[#405149] light:hover:bg-[#e3ece7]" onClick={() => zoomOut({ duration: 200 })}>
                    −
                </button>
                <button className="border border-[var(--graph-edge)] bg-[var(--graph-surface)] px-[9px] py-[6px] font-dm text-[10px] text-[var(--graph-label)] transition-colors hover:border-[#f2b84b] hover:text-[#f2b84b] light:border-[#b8c8c0] light:bg-[#f6f8f5] light:text-[#405149] light:hover:bg-[#e3ece7]" onClick={() => fitView({ padding: 0.18, duration: 350 })}>
                    FIT
                </button>
            </div>
        </div>
    );
}

export default GraphCanvas;
