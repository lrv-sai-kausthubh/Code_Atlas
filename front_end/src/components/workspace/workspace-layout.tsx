import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import type { XYPosition } from "@xyflow/react";
import type { DropTarget, Key } from "react-aria-components";
import { ChevronLeft, ChevronRight } from "lucide-react";
import JSZip from "jszip";
import AuraBar from "../aura/aura-bar";
import AnalysisPanel from "./analysis-panel";
import ExplorerPanel from "./explorer-panel";
import GraphPanel from "./graph-panel";
import ImagePreview from "../preview/image-preview";
import InspectorPanel from "./inspector-panel";
import { toastError, toastProcessing, toastSuccess } from "../../services/toast";
import { getProjectFileBlob } from "../../services/api";
import { downloadBlob, sanitizeFilename } from "../../services/download";
import type { NodeMovement } from "../atlas/atlas-types";
import type { AddedFile, AuraAction, ProjectGraph, ProjectNode } from "../../types/project";

function WorkspaceLayout({
  graph,
  projectId,
  selected,
  token,
  onSelect,
  positionOffsets,
  onMoveNodes,
  onBack,
}: {
  graph: ProjectGraph;
  projectId: string;
  selected: ProjectNode | null;
  token: string;
  onSelect: (node: ProjectNode) => void;
  positionOffsets: ReadonlyMap<string, XYPosition>;
  onMoveNodes: (next: Map<string, XYPosition>) => void;
  onBack: () => void;
}) {
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(() => {
    const stored = projectId
      ? localStorage.getItem(`ca-collapsed-${projectId}`)
      : null;
    if (stored) {
      try {
        return new Set(JSON.parse(stored) as string[]);
      } catch {
        // fall through to default
      }
    }
    const initial = new Set<string>();
    graph.nodes.forEach((node) => {
      if (node.type === "folder") initial.add(node.id);
    });
    return initial;
  });
  const [compact, setCompact] = useState(() => {
    const stored = projectId
      ? localStorage.getItem(`ca-compact-${projectId}`)
      : null;
    return stored ? stored === "1" : true;
  });
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [auraOpen, setAuraOpen] = useState(false);
  const [previewNode, setPreviewNode] = useState<ProjectNode | null>(null);
  const [focusNodeId, setFocusNodeId] = useState<string | null>(null);
  const focusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [layoutDirty, setLayoutDirty] = useState(false);
  const [renames, setRenames] = useState<ReadonlyMap<string, string>>(
    () => new Map(),
  );
  const [orderings, setOrderings] = useState<Map<string, string[]>>(
    () => new Map(),
  );
  const [explorerWidth, setExplorerWidth] = useState(
    () => Number(localStorage.getItem("ca-explorer-width")) || 230,
  );
  const [inspectorWidth, setInspectorWidth] = useState(
    () => Number(localStorage.getItem("ca-inspector-width")) || 245,
  );
  const [explorerCollapsed, setExplorerCollapsed] = useState(
    () => localStorage.getItem("ca-explorer-collapsed") === "1",
  );
  const [inspectorCollapsed, setInspectorCollapsed] = useState(
    () => localStorage.getItem("ca-inspector-collapsed") === "1",
  );
  const resizingRef = useRef<"explorer" | "inspector" | null>(null);
  const layoutRootRef = useRef<HTMLElement>(null);

  const persistLayout = (key: string, value: number) =>
    localStorage.setItem(key, String(value));

  const startResize =
    (which: "explorer" | "inspector") => (event: ReactPointerEvent) => {
      event.preventDefault();
      resizingRef.current = which;
      const originX = event.clientX;
      const startExplorer = explorerWidth;
      const startInspector = inspectorWidth;
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";

      const onMove = (move: PointerEvent) => {
        if (which === "explorer") {
          const next = Math.min(
            560,
            Math.max(160, startExplorer + (move.clientX - originX)),
          );
          setExplorerWidth(next);
          persistLayout("ca-explorer-width", next);
        } else {
          const next = Math.min(
            560,
            Math.max(160, startInspector - (move.clientX - originX)),
          );
          setInspectorWidth(next);
          persistLayout("ca-inspector-width", next);
        }
      };
      const onUp = () => {
        resizingRef.current = null;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    };

  const toggleExplorer = () => {
    setExplorerCollapsed((value) => {
      localStorage.setItem("ca-explorer-collapsed", value ? "0" : "1");
      return !value;
    });
  };
  const toggleInspector = () => {
    setInspectorCollapsed((value) => {
      localStorage.setItem("ca-inspector-collapsed", value ? "0" : "1");
      return !value;
    });
  };

  const toggleFolder = useCallback((nodeId: string) => {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  }, []);

  useEffect(() => {
    if (projectId) {
      localStorage.setItem(
        `ca-collapsed-${projectId}`,
        JSON.stringify([...collapsed]),
      );
    }
  }, [collapsed, projectId]);

  useEffect(() => {
    if (projectId) {
      localStorage.setItem(`ca-compact-${projectId}`, compact ? "1" : "0");
    }
  }, [compact, projectId]);

  const parentById = useMemo(() => {
    const parents = new Map<string, string>();
    graph.edges
      .filter((edge) => edge.relation !== "IMPORTS")
      .forEach((edge) => parents.set(edge.target, edge.source));
    return parents;
  }, [graph]);

  const handleSelect = useCallback(
    (node: ProjectNode) => {
      onSelect(node);
      if (focusTimerRef.current) clearTimeout(focusTimerRef.current);
      setFocusNodeId(node.id);
      focusTimerRef.current = setTimeout(() => setFocusNodeId(null), 1800);
      if (node.type === "file") {
        setCollapsed((current) => {
          const next = new Set(current);
          let parent = parentById.get(node.id);
          while (parent) {
            next.delete(parent);
            parent = parentById.get(parent);
          }
          return next;
        });
      }
      if (inspectorCollapsed) {
        localStorage.setItem("ca-inspector-collapsed", "0");
        setInspectorCollapsed(false);
      }
    },
    [inspectorCollapsed, onSelect, parentById],
  );

  const moveNodes = useCallback(
    (movements: NodeMovement[]) => {
      if (!graph) return;
      const isDescendant = (candidateId: string, ancestorId: string) => {
        let parent = parentById.get(candidateId);
        while (parent) {
          if (parent === ancestorId) return true;
          parent = parentById.get(parent);
        }
        return false;
      };
      const roots = movements.filter(
        (movement) =>
          !movements.some(
            (other) =>
              other.id !== movement.id && isDescendant(movement.id, other.id),
          ),
      );
      const next = new Map(positionOffsets);
      graph.nodes.forEach((node) => {
        const movement = roots
          .filter(
            (root) => node.id === root.id || isDescendant(node.id, root.id),
          )
          .reduce(
            (total, root) => ({
              x: total.x + root.delta.x,
              y: total.y + root.delta.y,
            }),
            { x: 0, y: 0 },
          );
        if (!movement.x && !movement.y) return;
        const offset = next.get(node.id) ?? { x: 0, y: 0 };
        next.set(node.id, {
          x: offset.x + movement.x,
          y: offset.y + movement.y,
        });
      });
      const changed = [...next.entries()].some(([nodeId, pos]) => {
        const prev = positionOffsets.get(nodeId);
        return !prev || prev.x !== pos.x || prev.y !== pos.y;
      });
      if (changed) setLayoutDirty(true);
      onMoveNodes(next);
    },
    [graph, onMoveNodes, parentById, positionOffsets],
  );

  const visibleGraph = useMemo(() => {
    const parentById = new Map<string, string>();
    graph.edges
      .filter((edge) => edge.relation !== "IMPORTS")
      .forEach((edge) => parentById.set(edge.target, edge.source));
    const isVisible = (nodeId: string) => {
      let parent = parentById.get(nodeId);
      while (parent) {
        if (collapsed.has(parent)) return false;
        parent = parentById.get(parent);
      }
      return true;
    };
    return graph.nodes.filter((node) => isVisible(node.id));
  }, [collapsed, graph]);

  const folderIds = useMemo(
    () =>
      graph.nodes
        .filter((node) => node.type === "folder")
        .map((node) => node.id),
    [graph],
  );
  const collapseAll = useCallback(() => {
    setCollapsed(new Set(folderIds));
    toastProcessing("Collapsing folder tree…");
  }, [folderIds]);
  const expandAll = useCallback(() => {
    setCollapsed(new Set());
    toastProcessing("Expanding folder tree…");
  }, []);
  const toggleCompact = useCallback(() => {
    setCompact((value) => !value);
    toastProcessing(`Re-laying out ${graph.nodes.length} nodes…`);
  }, [graph.nodes.length]);
  const toggleAnalysis = useCallback(
    () => setAnalysisOpen((value) => !value),
    [],
  );
  const toggleAura = useCallback(() => setAuraOpen((value) => !value), []);

  useEffect(() => {
    setLayoutDirty(false);
    setRenames(new Map());
    setOrderings(new Map());
  }, [projectId]);

  const handleRename = useCallback((nodeId: string, label: string) => {
    setRenames((prev) => {
      const next = new Map(prev);
      next.set(nodeId, label);
      return next;
    });
    setLayoutDirty(true);
  }, []);

  const handleExportLayout = useCallback(() => {
    if (!graph) return;
    const payload = {
      app: "CodeAtlas",
      version: 1,
      exported_at: new Date().toISOString(),
      project_id: graph.project_id,
      project: graph.project,
      layout_changed: true,
      position_offsets: Object.fromEntries(positionOffsets),
      renames: Object.fromEntries(renames),
      reorderings: Object.fromEntries(orderings),
      nodes: graph.nodes.map((node) => ({
        id: node.id,
        type: node.type,
        path: node.path,
        label: renames.get(node.id) ?? node.label,
      })),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `codeatlas-layout-${graph.project_id || "project"}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    toastSuccess("Layout exported");
  }, [graph, positionOffsets, renames, orderings]);

  const [addedFiles, setAddedFiles] = useState<AddedFile[]>([]);
  const [removedPaths, setRemovedPaths] = useState<Set<string>>(new Set());
  const [exportBusy, setExportBusy] = useState(false);

  useEffect(() => {
    setAddedFiles([]);
    setRemovedPaths(new Set());
    setExportBusy(false);
  }, [projectId]);

  const handleAddFiles = useCallback((files: File[]) => {
    setAddedFiles((prev) => [
      ...prev,
      ...files.map((file) => ({ path: file.name, file })),
    ]);
  }, []);

  const handleAddFolder = useCallback((files: File[]) => {
    setAddedFiles((prev) => [
      ...prev,
      ...files
        .filter((file) => file.webkitRelativePath)
        .map((file) => ({ path: file.webkitRelativePath, file })),
    ]);
  }, []);

  const handleDeleteNode = useCallback((node: ProjectNode) => {
    setRemovedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(node.path)) next.delete(node.path);
      else next.add(node.path);
      return next;
    });
  }, []);

  const handleRemoveAdded = useCallback((path: string) => {
    setAddedFiles((prev) => prev.filter((entry) => entry.path !== path));
  }, []);

  const childrenById = useMemo(() => {
    const map = new Map<string, ProjectNode[]>();
    graph.edges
      .filter((edge) => edge.relation !== "IMPORTS")
      .forEach((edge) => {
        const child = graph.nodes.find((node) => node.id === edge.target);
        if (child) map.set(edge.source, [...(map.get(edge.source) ?? []), child]);
      });
    return map;
  }, [graph]);



  const handleReorder = useCallback(
    (keys: Set<Key>, target: DropTarget) => {
      setOrderings((prev) => {
        const next = new Map(prev);
        const keyList = Array.from(keys, String);
        const ordered = (parentId: string, exclude: string[] = []) => {
          const base =
            parentId === "local-changes"
              ? addedFiles.map((entry) => entry.path)
              : (childrenById.get(parentId) ?? []).map((node) => node.id);
          const stored = next.get(parentId);
          const list = stored
            ? stored.filter((id) => base.includes(id))
            : [...base];
          for (const id of base) {
            if (!list.includes(id)) list.push(id);
          }
          return list.filter((id) => !exclude.includes(id));
        };
        const parentOf = (id: string) =>
          parentById.get(id) ??
          (addedFiles.some((entry) => entry.path === id)
            ? "local-changes"
            : "root");
        const place = (parentId: string, index: number) => {
          const list = ordered(parentId, keyList);
          const clamped = Math.max(0, Math.min(index, list.length));
          list.splice(clamped, 0, ...keyList);
          next.set(parentId, list);
        };
        const clearFromOthers = (parentId: string) => {
          for (const key of keyList) {
            const parent = parentOf(key);
            if (parent && parent !== parentId) {
              next.set(parent, ordered(parent, keyList));
            }
          }
        };
        if (target.type === "root") {
          place("root", 0);
          clearFromOthers("root");
        } else if (target.dropPosition === "on") {
          const parent = String(target.key);
          place(parent, 0);
          clearFromOthers(parent);
        } else {
          const anchor = String(target.key);
          const parent = parentOf(anchor);
          const list = ordered(parent, keyList);
          let index = list.indexOf(anchor);
          if (index < 0) index = list.length;
          if (target.dropPosition === "after") index += 1;
          list.splice(index, 0, ...keyList);
          next.set(parent, list);
          clearFromOthers(parent);
        }
        return next;
      });
    },
    [addedFiles, childrenById, parentById],
  );

  const handleExportZip = useCallback(async () => {
    if (!graph) return;
    setExportBusy(true);
    try {
      const zip = new JSZip();
      const rootName = sanitizeFilename(graph.project);
      let fetched = 0;
      let skipped = 0;
      for (const node of graph.nodes) {
        if (node.type !== "file") continue;
        if (removedPaths.has(node.path)) continue;
        if (node.access?.source === false) {
          skipped++;
          continue;
        }
        try {
          const response = await getProjectFileBlob(
            graph.project_id,
            node.path,
            token,
          );
          zip.file(`${rootName}/${node.path}`, response.data as Blob);
          fetched++;
        } catch {
          skipped++;
        }
      }
      for (const entry of addedFiles) {
        if (removedPaths.has(entry.path)) continue;
        const content = await entry.file.arrayBuffer();
        zip.file(`${rootName}/${entry.path}`, content);
      }
      zip.file(
        `${rootName}/.codeatlas/edits.json`,
        JSON.stringify(
          {
            app: "CodeAtlas",
            project_id: graph.project_id,
            project: graph.project,
            exported_at: new Date().toISOString(),
            removed: [...removedPaths].sort(),
            added: addedFiles.map((entry) => entry.path),
            reorderings: Object.fromEntries(orderings),
          },
          null,
          2,
        ),
      );
      const blob = await zip.generateAsync({ type: "blob" });
      downloadBlob(blob, `${rootName}-edited.zip`);
      toastSuccess(
        `ZIP exported — ${fetched} files${skipped ? `, ${skipped} skipped (no source access)` : ""}, ${addedFiles.length} added, ${removedPaths.size} removed.`,
      );
    } catch {
      toastError("Could not build the ZIP.");
    } finally {
      setExportBusy(false);
    }
  }, [addedFiles, graph, removedPaths, token]);

  const handleExportJson = useCallback(async () => {
    if (!graph) return;
    setExportBusy(true);
    try {
      const removed = [...removedPaths].sort();
      const nodes = graph.nodes
        .filter((node) => !removed.includes(node.path))
        .map((node) => ({
          ...node,
          label: renames.get(node.id) ?? node.label,
        }));
      const edges = graph.edges.filter(
        (edge) =>
          !removed.includes(
            graph.nodes.find((node) => node.id === edge.source)?.path ?? "",
          ) &&
          !removed.includes(
            graph.nodes.find((node) => node.id === edge.target)?.path ?? "",
          ),
      );
      const added = [];
      for (const entry of addedFiles) {
        if (removedPaths.has(entry.path)) continue;
        added.push({
          path: entry.path,
          name: entry.path.split("/").pop(),
          size_bytes: entry.file.size,
          content: await entry.file.text(),
        });
      }
      const payload = {
        app: "CodeAtlas",
        version: 1,
        exported_at: new Date().toISOString(),
        project_id: graph.project_id,
        project: graph.project,
        layout_changed: layoutDirty,
        position_offsets: Object.fromEntries(positionOffsets),
        renames: Object.fromEntries(renames),
        reorderings: Object.fromEntries(orderings),
        changes: { removed, added },
        graph: {
          ...graph,
          nodes,
          edges,
          files: graph.files - removed.length + added.length,
        },
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      });
      downloadBlob(blob, `${sanitizeFilename(graph.project)}-edited.json`);
      toastSuccess("JSON exported with your edits.");
    } catch {
      toastError("Could not build the JSON.");
    } finally {
      setExportBusy(false);
    }
  }, [addedFiles, graph, layoutDirty, positionOffsets, removedPaths, renames, orderings]);

  const gridCols = explorerCollapsed
    ? inspectorCollapsed
      ? "grid-cols-[0_0_minmax(0,1fr)_0_0]"
      : "grid-cols-[0_0_minmax(0,1fr)_4px_var(--inspector-width,245px)]"
    : inspectorCollapsed
      ? "grid-cols-[var(--explorer-width,230px)_4px_minmax(0,1fr)_0_0]"
      : "grid-cols-[var(--explorer-width,230px)_4px_minmax(0,1fr)_4px_var(--inspector-width,245px)]";
  const gridRows = "grid-rows-[minmax(0,1fr)]";

      const handleAgentAction = useCallback((action: AuraAction) => {
        if (!action.path) return;
        const node = graph?.nodes.find((entry) => entry.path === action.path);
        if (node) onSelect(node);
    }, [graph, onSelect]);

return (
    <section
      ref={layoutRootRef}
      className={`relative grid h-[calc(100vh-72px)] gap-0 p- ${gridCols} ${gridRows} max-[850px]:block max-[850px]:h-auto max-[850px]:min-h-[calc(100vh-72px)]`}
      style={
        {
          "--explorer-width": explorerCollapsed ? "0px" : `${explorerWidth}px`,
          "--inspector-width": inspectorCollapsed
            ? "0px"
            : `${inspectorWidth}px`,
        } as CSSProperties
      }
    >
      <ExplorerPanel
        graph={graph}
        query={query}
        setQuery={setQuery}
        selected={selected}
        collapsed={collapsed}
        onSelect={handleSelect}
        onToggle={toggleFolder}
        explorerCollapsed={explorerCollapsed}
        onToggleCollapse={toggleExplorer}
        addedFiles={addedFiles}
        removedPaths={removedPaths}
        onAddFiles={handleAddFiles}
        onAddFolder={handleAddFolder}
        onDeleteNode={handleDeleteNode}
        onRemoveAdded={handleRemoveAdded}
        orderings={orderings}
        onReorder={handleReorder}
        onExportZip={() => void handleExportZip()}
        onExportJson={() => void handleExportJson()}
        exportBusy={exportBusy}
      />
      {explorerCollapsed && (
        <button
          className="absolute inset-y-0 left-0 z-[6] flex w-[18px] items-center justify-center border-0 border-r border-[var(--ca-hairline)] bg-[var(--ca-canvas-soft)] text-[var(--ca-muted)] transition-[background,color] duration-150 hover:bg-[var(--ca-surface-strong)] hover:text-[var(--ca-primary)]"
          title="Open explorer"
          onClick={toggleExplorer}
        >
          <ChevronRight size={16} />
        </button>
      )}
      <div
        className={`relative z-[5] col-start-2 row-start-1 cursor-col-resize before:absolute before:inset-y-0 before:left-px before:right-px before:bg-transparent before:transition-colors before:duration-150 hover:before:bg-[var(--ca-hairline-strong)] ${resizingRef.current === "explorer" ? "bg-[var(--ca-hairline-strong)] " : ""} max-[850px]:hidden`}
        onPointerDown={startResize("explorer")}
      />
      <GraphPanel
        graph={graph}
        collapsed={collapsed}
        selected={selected}
        focusNodeId={focusNodeId}
        onSelect={handleSelect}
        onToggle={toggleFolder}
        compact={compact}
        onToggleCompact={toggleCompact}
        analysisOpen={analysisOpen}
        onToggleAnalysis={toggleAnalysis}
        auraOpen={auraOpen}
        onToggleAura={toggleAura}
        onCollapseAll={collapseAll}
        onExpandAll={expandAll}
        positionOffsets={positionOffsets}
        onMoveNodes={moveNodes}
        visibleNodes={visibleGraph.length}
        onBack={onBack}
        projectId={projectId}
        token={token}
        layoutDirty={layoutDirty}
        onExportLayout={handleExportLayout}
        renames={renames}
        onRename={handleRename}
      />
      <div
        className={`relative z-[5] col-start-4 row-start-1 cursor-col-resize before:absolute before:inset-y-0 before:left-px before:right-px before:bg-transparent before:transition-colors before:duration-150 hover:before:bg-[var(--ca-hairline-strong)] ${resizingRef.current === "inspector" ? "bg-[var(--ca-hairline-strong)] " : ""} max-[850px]:hidden`}
        onPointerDown={startResize("inspector")}
      />
      <InspectorPanel
        graph={graph}
        selected={selected}
        projectId={projectId}
        token={token}
        inspectorCollapsed={inspectorCollapsed}
        onToggleCollapse={toggleInspector}
        onOpenPreview={setPreviewNode}
        onSelect={handleSelect}
      />
      {inspectorCollapsed && (
        <button
          className="absolute inset-y-0 right-0 z-[6] flex w-[18px] items-center justify-center border-0 border-l border-[var(--ca-hairline)] bg-[var(--ca-canvas-soft)] text-[var(--ca-muted)] transition-[background,color] duration-150 hover:bg-[var(--ca-surface-strong)] hover:text-[var(--ca-primary)]"
          title="Open inspector"
          onClick={toggleInspector}
        >
          <ChevronLeft size={16} />
        </button>
      )}
      {analysisOpen && (
        <div className="absolute inset-y-0 right-[var(--inspector-width,245px)] z-[7] w-[420px] max-w-[46%] overflow-hidden border-l border-[var(--ca-hairline)] bg-[var(--ca-surface-card)] animate-slide-left  ">
          <AnalysisPanel
            analysis={graph.analysis}
            onClose={() => setAnalysisOpen(false)}
          />
        </div>
      )}
      {previewNode && (
        <ImagePreview
          node={previewNode}
          projectId={projectId}
          token={token}
          onClose={() => setPreviewNode(null)}
        />
      )}
      {auraOpen && (
        <AuraBar
          graph={graph}
          projectId={projectId}
          token={token}
          onClose={() => setAuraOpen(false)}
          onAgentAction={handleAgentAction}
        />
      )}
    </section>
  );
}

export default WorkspaceLayout;
