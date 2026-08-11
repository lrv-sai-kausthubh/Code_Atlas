import { useMemo, useState, useEffect } from "react";
import {
  Button,
  Collection,
  DropIndicator,
  Tree,
  TreeItem,
  TreeItemContent,
  useDragAndDrop,
} from "react-aria-components";
import type { DropTarget, Key, Selection } from "react-aria-components";
import {
  ChevronRight,
  Folder,
  FolderOpen,
  GripVertical,
  Lock,
  Trash2,
} from "lucide-react";
import { fileIcon } from "../atlas/file-utils";

export type AtlasTreeNode = {
  id: string;
  label: string;
  kind: "folder" | "file" | "added";
  path?: string;
  state: "normal" | "added" | "removed";
  restricted?: boolean;
  action?: "delete" | "restore" | "none";
  children?: AtlasTreeNode[];
};

const SIZES = {
  sm: {
    row: "min-h-[28px] text-[11px]",
    pad: 14,
    icon: 18,
    chevron: 14,
    grip: 12,
  },
  md: {
    row: "min-h-8 text-[13px]",
    pad: 16,
    icon: 20,
    chevron: 16,
    grip: 13,
  },
} as const;

function AtlasTree({
  items,
  flat = false,
  selectedKey,
  onSelectKey,
  collapsed,
  onToggle,
  onDelete,
  onRestore,
  onReorder,
  size = "sm",
}: {
  items: AtlasTreeNode[];
  flat?: boolean;
  selectedKey: Key | null;
  onSelectKey: (key: Key) => void;
  collapsed: Set<string>;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onRestore: (id: string) => void;
  onReorder: (keys: Set<Key>, target: DropTarget) => void;
  size?: keyof typeof SIZES;
}) {
  const tokens = SIZES[size];
  const [multiSelected, setMultiSelected] = useState<Set<Key>>(new Set());

  useEffect(() => {
    if (selectedKey != null) {
      setMultiSelected((prev) => {
        const next = new Set(prev);
        next.add(selectedKey);
        return next;
      });
    }
  }, [selectedKey]);

  const folderIds = useMemo(() => {
    const ids: string[] = [];
    const walk = (nodes: AtlasTreeNode[]) => {
      for (const node of nodes) {
        if (node.kind === "folder") ids.push(node.id);
        if (node.children) walk(node.children);
      }
    };
    walk(items);
    return ids;
  }, [items]);

  const expandedKeys = useMemo(() => {
    const expanded = new Set<string>();
    for (const id of folderIds) {
      if (!collapsed.has(id)) expanded.add(id);
    }
    return expanded;
  }, [folderIds, collapsed]);

  const handleExpandedChange = (keys: Iterable<Key>) => {
    const expanded = new Set(Array.from(keys, String));
    for (const id of folderIds) {
      const isExpanded = expanded.has(id);
      if (collapsed.has(id) === isExpanded) onToggle(id);
    }
  };

  const handleSelectionChange = (keys: Selection) => {
    const next = new Set<Key>(Array.from(keys));
    setMultiSelected(next);
    const last = Array.from(next).pop();
    if (last != null) onSelectKey(last);
  };

  const { dragAndDropHooks } = useDragAndDrop({
    getItems: (keys) =>
      Array.from(keys, (key) => ({ "tree-item": String(key) })),
    onReorder: (event) => onReorder(event.keys, event.target),
    onMove: (event) => onReorder(event.keys, event.target),
    renderDropIndicator: (target) => (
      <DropIndicator
        target={target}
        className="h-[2px] bg-[var(--ca-primary)]"
      />
    ),
  });

  const renderContent = (item: AtlasTreeNode) => {
    const removed = item.state === "removed";
    const added = item.state === "added";
    const isFolder = item.kind === "folder";
    const action = item.action ?? (removed ? "restore" : "delete");
    const IconSpec = isFolder
      ? null
      : fileIcon(added ? item.label : item.label);
    const FileIcon = added
      ? fileIcon(item.label).Icon
      : IconSpec?.Icon ?? null;

    return ({
      isExpanded,
      hasChildItems,
      isSelected,
    }: {
      isExpanded: boolean;
      hasChildItems: boolean;
      isSelected: boolean;
    }) => (
      <div
        className="flex min-w-0 flex-1 items-center gap-1.5 pr-1"
        onClick={() => {
          if (hasChildItems) onToggle(item.id);
        }}
      >
        {!flat && (
          <Button
            slot="drag"
            className="flex h-4 w-4 shrink-0 items-center justify-center rounded border-0 bg-transparent p-0 text-[var(--ca-muted-soft)] opacity-0 transition-opacity group-hover:opacity-100"
            onPointerDown={(event) => event.stopPropagation()}
          >
            <GripVertical size={tokens.grip} />
          </Button>
        )}
        {hasChildItems ? (
          <Button
            slot="chevron"
            className="flex h-4 w-4 shrink-0 items-center justify-center rounded border-0 bg-transparent p-0 text-[var(--ca-muted)] transition-colors hover:text-[var(--ca-ink)]"
            onClick={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <ChevronRight
              size={tokens.chevron}
              className="transition-transform duration-150"
              style={{ transform: isExpanded ? "rotate(90deg)" : "none" }}
            />
          </Button>
        ) : (
          <span className="w-4 shrink-0" />
        )}
        <span
          className={`flex shrink-0 items-center justify-center ${
            removed
              ? "text-[var(--ca-error)]"
              : added
                ? "text-[var(--ca-success)]"
                : isFolder
                  ? "text-[var(--ca-muted)]"
                  : (IconSpec?.className ?? "")
          }`}
          style={{ width: `${tokens.icon}px` }}
        >
          {isFolder ? (
            isExpanded ? (
              <FolderOpen size={tokens.icon} strokeWidth={1.8} />
            ) : (
              <Folder size={tokens.icon} strokeWidth={1.8} />
            )
          ) : FileIcon ? (
            <FileIcon size={tokens.icon} strokeWidth={1.8} />
          ) : null}
        </span>
        <span
          className={`min-w-0 truncate ${
            removed
              ? "line-through text-[var(--ca-error)]"
              : isSelected
                ? "text-[var(--ca-ink)]"
                : "text-[var(--ca-body)]"
          }`}
        >
          {item.label}
        </span>
        {item.restricted && (
          <Lock
            className="shrink-0 text-[var(--ca-error)]"
            size={12}
            aria-label="Restricted — metadata only"
          />
        )}
        {removed && (
          <span className="ca-mono-label shrink-0 text-[8px] font-medium text-[var(--ca-error)]">
            REMOVED
          </span>
        )}
        {added && (
          <span className="ca-mono-label shrink-0 text-[8px] font-medium text-[var(--ca-success)]">
            ADDED
          </span>
        )}
        {!removed && !added && item.kind !== "folder" && (
          <small className="ca-mono-label ml-auto shrink-0 text-[8px] text-[var(--ca-muted)]">
            {item.path?.split(".").pop()}
          </small>
        )}
        {action === "delete" && (
          <button
            className="hidden shrink-0 rounded border-0 p-1 text-[var(--ca-muted)] transition-colors hover:bg-[color-mix(in_srgb,var(--ca-error)_12%,transparent)] hover:text-[var(--ca-error)] group-hover:block"
            title={`Delete ${item.label} from the exported project`}
            onClick={(event) => {
              event.stopPropagation();
              onDelete(item.id);
            }}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <Trash2 size={12} />
          </button>
        )}
        {action === "restore" && (
          <button
            className="ca-mono-label shrink-0 border-0 bg-transparent p-1 text-[8px] uppercase text-[var(--ca-primary)] transition-colors hover:text-[var(--ca-ink)]"
            title="Restore this file"
            onClick={(event) => {
              event.stopPropagation();
              onRestore(item.id);
            }}
            onPointerDown={(event) => event.stopPropagation()}
          >
            Undo
          </button>
        )}
      </div>
    );
  };

  const renderItem = (item: AtlasTreeNode) => (
    <TreeItem
      id={item.id}
      textValue={item.label}
      className={({ isSelected }) =>
        `group flex w-full items-center border-0 border-l-2 font-mono transition-colors ${
          tokens.row
        } ${
          isSelected
            ? "border-l-[var(--ca-primary)] bg-[color-mix(in_srgb,var(--ca-primary)_10%,var(--ca-surface-strong))]"
            : "border-l-transparent"
        } hover:bg-[var(--ca-surface-strong)] ${
          item.state === "removed" ? "opacity-60" : ""
        } outline-none data-[focus-visible]:bg-[var(--ca-surface-strong)]`
      }
      style={({ level }) => ({
        paddingLeft: `${8 + level * tokens.pad}px`,
      })}
    >
      <TreeItemContent>{renderContent(item)}</TreeItemContent>
      {item.children && item.children.length > 0 && (
        <Collection items={item.children}>{renderItem}</Collection>
      )}
    </TreeItem>
  );

  return (
    <Tree
      aria-label={flat ? "Search results" : "Project tree"}
      items={items}
      selectionMode="multiple"
      selectionBehavior="toggle"
      selectedKeys={multiSelected}
      onSelectionChange={handleSelectionChange}
      expandedKeys={expandedKeys}
      onExpandedChange={handleExpandedChange}
      dragAndDropHooks={flat ? undefined : dragAndDropHooks}
      className="outline-none"
    >
      {renderItem}
    </Tree>
  );
}

export default AtlasTree;
