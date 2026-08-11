import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DragEvent } from "react";
import { Plus, Minus } from "lucide-react";
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
  ControlButton,
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
    <div className="absolute top-[14px] right-[160px] z-[5] ca-mono-label !text-[10px] text-[var(--graph-label)] max-[850px]:right-[126px]">
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
  renames = new Map(),
  onRename,
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
  renames: ReadonlyMap<string, string>;
  onRename?: (nodeId: string, label: string) => void;
}) {
  const {
    fitView,
    zoomIn,
    zoomOut,
    screenToFlowPosition,
    setViewport,
    getViewport,
  } = useReactFlow();
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
  const visibleGraph = useMemo(() => {
    const nodes = graph.nodes.filter((node) => !hiddenIds.has(node.id));
    const visibleIds = new Set(nodes.map((node) => node.id));
    const edges = graph.edges.filter(
      (edge) => visibleIds.has(edge.source) && visibleIds.has(edge.target),
    );
    return { ...graph, nodes, edges };
  }, [graph, hiddenIds]);
  const initial = useMemo(
    () =>
      makeLayout(
        visibleGraph,
        onSelect,
        onToggle,
        compact,
        positionOffsets,
        focusNodeId,
        renames,
        onRename,
      ),
    [
      compact,
      focusNodeId,
      onRename,
      onSelect,
      onToggle,
      positionOffsets,
      renames,
      visibleGraph,
    ],
  );
  const [nodes, setNodes] = useNodesState<AtlasNode>(initial.nodes);
  const [imageNodes, setImageNodes] = useState<ImageAtlasNode[]>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initial.edges);
  const [isDragging, setIsDragging] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const hasFittedInitialView = useRef(false);
  const previousLayout = useRef(initial);
  const previousHiddenKey = useRef([...hiddenIds].sort().join(","));
  const nodesRef = useRef(nodes);
  const dragStart = useRef<Map<string, XYPosition>>(new Map());
  const viewportSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  const saveViewport = useCallback(() => {
    try {
      const projectId = graph.project_id;
      if (!projectId) return;
      const viewport = getViewport();
      localStorage.setItem(
        `codeatlas-viewport-${projectId}`,
        JSON.stringify(viewport),
      );
    } catch {
      // ignore
    }
  }, [getViewport, graph.project_id]);

  useEffect(() => {
    return () => {
      if (viewportSaveTimer.current) clearTimeout(viewportSaveTimer.current);
    };
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (!hasFittedInitialView.current) {
        let restored = false;
        try {
          const projectId = graph.project_id;
          if (projectId) {
            const stored = localStorage.getItem(
              `codeatlas-viewport-${projectId}`,
            );
            if (stored) {
              const viewport = JSON.parse(stored) as {
                x: number;
                y: number;
                zoom: number;
              };
              if (
                typeof viewport.x === "number" &&
                typeof viewport.y === "number" &&
                typeof viewport.zoom === "number"
              ) {
                setViewport(viewport, { duration: 0 });
                restored = true;
              }
            }
          }
        } catch {
          // ignore
        }
        if (!restored) {
          fitView({ padding: 0.18, duration: 350 });
        }
        hasFittedInitialView.current = true;
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [fitView, graph.project_id, setViewport]);

  useEffect(() => {
    const hiddenKey = [...hiddenIds].sort().join(",");
    if (hiddenKey !== previousHiddenKey.current) {
      previousHiddenKey.current = hiddenKey;
      const frame = requestAnimationFrame(() => {
        fitView({ padding: 0.18, duration: 400 });
      });
      return () => cancelAnimationFrame(frame);
    }
  }, [fitView, hiddenIds]);

  useEffect(() => {
    if (!focusNodeId || !graph.nodes.some((node) => node.id === focusNodeId))
      return;
    const frame = requestAnimationFrame(() => {
      fitView({
        nodes: [{ id: focusNodeId }],
        padding: 1.8,
        duration: 550,
        maxZoom: 1.35,
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [fitView, focusNodeId, graph.nodes]);

  useEffect(() => {
    const reflow = previousLayout.current !== initial;
    previousLayout.current = initial;
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
  }, [hiddenIds, initial, setEdges, setNodes]);

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
        (change) =>
          "id" in change && imageNodes.some((node) => node.id === change.id),
      );
      const layoutChanges = changes.filter(
        (change) =>
          !("id" in change) ||
          !imageNodes.some((node) => node.id === change.id),
      );
      if (imageChanges.length) {
        setImageNodes((current) =>
          applyNodeChanges(
            imageChanges as NodeChange<ImageAtlasNode>[],
            current,
          ),
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
          return before.data.type === "folder" || before.data.type === "project"
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
        onMoveEnd={saveViewport}
        onNodeClick={(_, node) => {
          if (node.type === "image") {
            onSelect((node.data as ImageNodeData).node);
          } else {
            onSelect(node.data as AtlasNodeData);
            if ((node.data as AtlasNodeData).type === "folder")
              onToggle(node.id);
          }
        }}
        nodesDraggable
        nodesConnectable={false}
        selectionOnDrag
        selectionMode={SelectionMode.Partial}
        panOnDrag={[1, 2]}
        onlyRenderVisibleElements
        proOptions={{ hideAttribution: true }}
      >
        <Background color="var(--graph-grid)" gap={35} size={2} />

        {!isDragging && (
          <MiniMap
            nodeColor={(node) =>
              node.type === "image"
                ? "var(--node-file)"
                : NODE_COLORS[(node.data as AtlasNodeData).type]
            }
            maskColor="var(--minimap-mask)"
            pannable
            zoomable
          />
        )}
      </ReactFlow>
      {isDragOver && (
        <div className="pointer-events-none absolute inset-3 z-[7] pt-10 flex items-center justify-center border-2 border-dashed border-[var(--ca-primary)] bg-[color-mix(in_srgb,var(--ca-primary)_8%,transparent)] ca-mono-label !text-[11px] text-[var(--ca-primary)]">
          DROP IMAGE TO ADD AS A NODE
        </div>
      )}
      <div className="pointer-events-none absolute bottom-3 left-5 z-[5] ca-mono-label !text-[9px] text-[var(--ca-muted)]">
        DRAG ON CANVAS TO LASSO <span>·</span> MIDDLE-CLICK TO PAN{" "}
        <span>·</span> DRAG NODES
      </div>
      <Controls
        showZoom={true}
        showFitView={true}
        showInteractive={true}
        position="bottom-left"
      />
      <Controls>
        <ControlButton
          onClick={() => {
            console.log("Trace clicked");
          }}
          title="Trace selected node"
        >
          🔍
        </ControlButton>

        <ControlButton
          onClick={() => {
            console.log("Layout clicked");
          }}
          title="Auto Layout"
        >
          🧩
        </ControlButton>
      </Controls>
      <ZoomBadge />
      <div className="absolute top-[10px] right-5 z-[6] flex gap-1.5">
        <button
          className="border border-[var(--graph-edge)] bg-[var(--graph-surface)] px-[9px] py-[6px] ca-mono-label !text-[10px] text-[var(--graph-label)] transition-colors hover:border-[var(--ca-primary)] hover:text-[var(--ca-primary)] "
          onClick={() => zoomIn({ duration: 200 })}
        >
          <Plus size={15} />
        </button>
        <button
          className="border border-[var(--graph-edge)] bg-[var(--graph-surface)] px-[9px] py-[6px] ca-mono-label !text-[10px] text-[var(--graph-label)] transition-colors hover:border-[var(--ca-primary)] hover:text-[var(--ca-primary)] "
          onClick={() => zoomOut({ duration: 200 })}
        >
          <Minus size={15} />
        </button>
        <button
          className="border border-[var(--graph-edge)] bg-[var(--graph-surface)] px-[9px] py-[6px] ca-mono-label !text-[10px] text-[var(--graph-label)] transition-colors hover:border-[var(--ca-primary)] hover:text-[var(--ca-primary)] "
          onClick={() => fitView({ padding: 0.18, duration: 350 })}
        >
          FIT
        </button>
      </div>
    </div>
  );
}

export default GraphCanvas;
