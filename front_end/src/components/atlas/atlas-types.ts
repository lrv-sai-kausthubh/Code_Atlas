import type { Node, XYPosition } from "@xyflow/react";
import type { ProjectNode } from "../../types/project";

export const NODE_COLORS: Record<ProjectNode["type"], string> = {
    project: "#f2b84b",
    folder: "#64d5c4",
    file: "#9ca9ff",
};

export type AtlasNodeData = ProjectNode & {
    onSelect: (node: ProjectNode) => void;
    onToggle: (nodeId: string) => void;
    selected: boolean;
    focused: boolean;
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
