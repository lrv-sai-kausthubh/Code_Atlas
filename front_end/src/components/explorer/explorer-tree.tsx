import { useMemo } from "react";
import type { Key, DropTarget } from "react-aria-components";
import { Plus, SearchX } from "lucide-react";
import type { AddedFile, ProjectGraph, ProjectNode } from "../../types/project";
import AtlasTree from "./atlas-tree";
import type { AtlasTreeNode } from "./atlas-tree";
import EmptyState from "../empty-state";

function ExplorerTree({
  graph,
  query,
  selected,
  collapsed,
  onSelect,
  onToggle,
  addedFiles,
  removedPaths,
  onDeleteNode,
  onRemoveAdded,
  orderings,
  onReorder,
}: {
  graph: ProjectGraph;
  query: string;
  selected: ProjectNode | null;
  collapsed: Set<string>;
  onSelect: (node: ProjectNode) => void;
  onToggle: (nodeId: string) => void;
  addedFiles: AddedFile[];
  removedPaths: Set<string>;
  onDeleteNode: (node: ProjectNode) => void;
  onRemoveAdded: (path: string) => void;
  orderings: Map<string, string[]>;
  onReorder: (keys: Set<Key>, target: DropTarget) => void;
}) {
  const childrenMap = useMemo(() => {
    const map = new Map<string, ProjectNode[]>();
    graph.edges
      .filter((edge) => edge.relation !== "IMPORTS")
      .forEach((edge) => {
        const child = graph.nodes.find((node) => node.id === edge.target);
        if (child)
          map.set(edge.source, [
            ...(map.get(edge.source) ?? []),
            child,
          ]);
      });
    return map;
  }, [graph]);

  const nodeById = useMemo(
    () => new Map(graph.nodes.map((node) => [node.id, node])),
    [graph],
  );

  const ordered = <T extends { id?: string; path: string }>(
    parentId: string,
    list: T[],
  ): T[] => {
    const override = orderings.get(parentId);
    if (!override) return list;
    const idOf = (entry: T) => entry.id ?? entry.path;
    const overridden = new Set(list.map(idOf).filter((id) => override.includes(id)));
    const inOrder = (a: T, b: T) =>
      override.indexOf(idOf(a)) - override.indexOf(idOf(b));
    return [
      ...list.filter((entry) => overridden.has(idOf(entry))).sort(inOrder),
      ...list.filter((entry) => !overridden.has(idOf(entry))),
    ];
  };

  const itemFor = (node: ProjectNode): AtlasTreeNode => ({
    id: node.id,
    label: node.label,
    path: node.path,
    kind: node.type === "folder" ? "folder" : "file",
    restricted: node.type === "file" && node.access?.source === false,
    state: removedPaths.has(node.path) ? "removed" : "normal",
    children: ordered(node.id, childrenMap.get(node.id) ?? []).map(itemFor),
  });

  const localChanges = useMemo<AtlasTreeNode | null>(() => {
    if (addedFiles.length === 0) return null;
    return {
      id: "local-changes",
      label: "LOCAL CHANGES",
      kind: "folder",
      state: "normal",
      children: ordered("local-changes", addedFiles).map((entry): AtlasTreeNode => {
        const removed = removedPaths.has(entry.path);
        return {
          id: entry.path,
          label: entry.path.split("/").pop() ?? entry.path,
          path: entry.path,
          kind: "added",
          state: removed ? "removed" : "added",
          action: removed ? "none" : "delete",
        };
      }),
    };
  }, [addedFiles, orderings, removedPaths]);

  const rootItems = useMemo(
    () => ordered("root", childrenMap.get("root") ?? []).map(itemFor),
    [childrenMap, orderings],
  );

  const searching = query.trim().length > 0;
  const matches = useMemo(() => {
    if (!searching) return [];
    return graph.nodes
      .filter(
        (node) =>
          node.label.toLowerCase().includes(query.toLowerCase()) &&
          node.id !== "root",
      )
      .map((node) => ({ ...itemFor(node), children: undefined }));
  }, [graph, query, searching]);

  const items = useMemo(
    () => (localChanges ? [localChanges, ...rootItems] : rootItems),
    [localChanges, rootItems],
  );

  const handleSelectKey = (key: Key) => {
    const node = nodeById.get(String(key));
    if (node) onSelect(node);
  };

  const handleDelete = (id: string) => {
    const node = nodeById.get(id);
    if (node) onDeleteNode(node);
    else onRemoveAdded(id);
  };

  const handleRestore = (id: string) => {
    const node = nodeById.get(id);
    if (node) onDeleteNode(node);
  };

  if (searching && matches.length === 0) {
    return (
      <>
        <EmptyState
          compact
          icon={SearchX}
          title="No matching files"
          description="Nothing in this project matches your search."
        />
        {localChanges && (
          <div className="mt-4 border-t border-[var(--ca-hairline)] pt-3">
            <div className="ca-mono-label mb-2 flex items-center gap-1.5 text-[9px] text-[var(--ca-success)]">
              <Plus size={11} /> LOCAL CHANGES ({addedFiles.length})
            </div>
            <AtlasTree
              flat
              items={localChanges.children ?? []}
              selectedKey={null}
              onSelectKey={() => {}}
              collapsed={collapsed}
              onToggle={onToggle}
              onDelete={handleDelete}
              onRestore={handleRestore}
              onReorder={onReorder}
              size="md"
            />
          </div>
        )}
      </>
    );
  }

  return (
    <>
      <AtlasTree
        flat={searching}
        items={searching ? matches : items}
        selectedKey={selected?.id ?? null}
        onSelectKey={handleSelectKey}
        collapsed={collapsed}
        onToggle={onToggle}
        onDelete={handleDelete}
        onRestore={handleRestore}
        onReorder={onReorder}
        size="md"
      />
      {searching && localChanges && (
        <div className="mt-4 border-t border-[var(--ca-hairline)] pt-3">
          <div className="ca-mono-label mb-2 flex items-center gap-1.5 text-[9px] text-[var(--ca-success)]">
            <Plus size={11} /> LOCAL CHANGES ({addedFiles.length})
          </div>
          <AtlasTree
            flat
            items={localChanges.children ?? []}
            selectedKey={null}
            onSelectKey={() => {}}
            collapsed={collapsed}
            onToggle={onToggle}
            onDelete={handleDelete}
            onRestore={handleRestore}
            onReorder={onReorder}
            size="md"
          />
        </div>
      )}
    </>
  );
}

export default ExplorerTree;
