import type { CSSProperties } from "react";
import { Handle, Position } from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";
import { Folder, GitFork, Lock } from "lucide-react";
import { fileIcon } from "./file-utils";
import { NODE_COLORS } from "./atlas-types";
import type { AtlasNode, ImageAtlasNode } from "./atlas-types";

export function AtlasNodeView({ data }: NodeProps<AtlasNode>) {
    const color = NODE_COLORS[data.type];
    const restricted = data.type === "file" && data.access?.source === false;
    const { Icon: FileTypeIcon } = fileIcon(data.label);
    return (
        <div
            className={`atlas-node atlas-node-${data.type} ${data.selected ? "is-selected" : ""} ${data.focused ? "is-focused" : ""} ${restricted ? "atlas-node-restricted" : ""}`}
            style={{ "--node-color": color } as CSSProperties}
            onClick={() => data.onSelect(data)}
            title={restricted ? `${data.label} — restricted (metadata only)` : data.path || data.label}
        >
            <Handle type="target" position={Position.Top} className="atlas-handle" />
            <div className={`atlas-node-dot ${data.type === "file" ? fileIcon(data.label).className : ""}`}>
                {data.type === "project" ? (
                    <GitFork size={20} strokeWidth={1.8} />
                ) : data.type === "folder" ? (
                    <Folder size={20} strokeWidth={1.8} />
                ) : (
                    <FileTypeIcon size={20} strokeWidth={1.8} />
                )}
            </div>
            <div className="atlas-node-label" title={data.path || data.label}>
                {data.label}
            </div>
            {data.type !== "file" && <div className="atlas-node-kind">{data.type}</div>}
            {restricted && (
                <div className="atlas-node-restricted-badge">
                    <Lock size={10} strokeWidth={2.2} />
                    RESTRICTED
                </div>
            )}
            <Handle type="source" position={Position.Bottom} className="atlas-handle" />
        </div>
    );
}

export function ImageNodeView({ data }: NodeProps<ImageAtlasNode>) {
    return (
        <div
            className="atlas-node atlas-node-image"
            style={{ "--node-color": NODE_COLORS.file } as CSSProperties}
            onClick={() => data.onSelect(data.node)}
            title={data.node.path || data.node.label}
        >
            <img
                src={data.src}
                alt={data.node.label}
                draggable={false}
                className="block max-h-[160px] max-w-[220px] rounded object-contain bg-[#101314]"
            />
            <div className="atlas-node-label">{data.node.label}</div>
            <div className="atlas-node-kind">image</div>
        </div>
    );
}

