import type { Node, XYPosition } from "@xyflow/react";
import type { ProjectNode } from "../../types/project";

export const NODE_COLORS: Record<ProjectNode["type"], string> = {
    project: "var(--node-project)",
    folder: "var(--node-folder)",
    file: "var(--node-file)",
};

export type AtlasNodeData = ProjectNode & {
    onSelect: (node: ProjectNode) => void;
    onToggle: (nodeId: string) => void;
    selected: boolean;
    focused: boolean;
    onRename?: (nodeId: string, label: string) => void;
};

export type AtlasNode = Node<AtlasNodeData, "atlas">;

export type ImageNodeData = {
    src: string;
    node: ProjectNode;
    onSelect: (node: ProjectNode) => void;
};

export type ImageAtlasNode = Node<ImageNodeData, "image">;

export type GraphNode = AtlasNode | ImageAtlasNode;

export type NodeMovement = { id: string; delta: XYPosition };
