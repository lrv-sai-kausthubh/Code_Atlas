import { useEffect, useState } from "react";
import type { DragEvent } from "react";
import { FileText, Image as ImageIcon, X } from "lucide-react";
import { getProjectFileBlob } from "../../services/api";
import type { ProjectNode } from "../../types/project";
import { IMAGE_EXTENSIONS, PDF_EXTENSION } from "../atlas/file-utils";
import { IMAGE_DROP_MIME } from "../atlas/graph-canvas";
import type { ImageDropPayload } from "../atlas/graph-canvas";

function ImagePreview({
    node,
    projectId,
    token,
    onClose,
}: {
    node: ProjectNode;
    projectId: string;
    token: string;
    onClose: () => void;
}) {
    const extension = node.label.toLowerCase().split(".").pop() ?? "";
    const isImage = IMAGE_EXTENSIONS.has(extension);
    const isPdf = extension === PDF_EXTENSION;
    const [src, setSrc] = useState<string | null>(null);
    const [error, setError] = useState(false);

    useEffect(() => {
        let alive = true;
        if ((!isImage && !isPdf) || !projectId) return;
        setSrc(null);
        setError(false);
        getProjectFileBlob(projectId, node.path, token)
            .then((response) => {
                if (!alive) return;
                setSrc(URL.createObjectURL(response.data));
            })
            .catch(() => {
                if (alive) setError(true);
            });
        return () => {
            alive = false;
        };
    }, [isImage, isPdf, node.path, projectId, token]);

    if ((!isImage && !isPdf) || !src) return null;

    const onDragStart = (event: DragEvent) => {
        const payload: ImageDropPayload = { src, node };
        event.dataTransfer.setData(IMAGE_DROP_MIME, JSON.stringify(payload));
        event.dataTransfer.effectAllowed = "copy";
    };

    return (
        <div className="fixed right-6 top-[84px] z-40 w-[420px] border border-[var(--ca-hairline)] bg-[var(--ca-surface-card)]">
            <div className="flex items-center justify-between border-b border-[var(--ca-hairline)] px-[14px] py-3 ca-mono-label !text-[10px] text-[var(--ca-muted)]">
                <span className="flex items-center gap-2">
                    {isImage ? (
                        <ImageIcon size={16} className="text-[var(--ca-primary)]" />
                    ) : (
                        <FileText size={16} className="text-[var(--ca-primary)]" />
                    )}
                    IMAGE PREVIEW
                </span>
                <button
                    className="inline-flex h-[22px] w-[22px] items-center justify-center border border-transparent bg-transparent text-[var(--ca-muted)] transition-colors hover:border-[var(--ca-hairline-strong)] hover:text-[var(--ca-primary)]"
                    onClick={onClose}
                    aria-label="Close preview"
                >
                    <X size={16} />
                </button>
            </div>
            <div className="p-[14px]">
                <div className="mb-3 truncate ca-mono-label !text-[11px] text-[var(--ca-ink)]">
                    {node.label}
                </div>
                {error ? (
                    <div className="flex h-[200px] items-center justify-center border border-dashed border-[var(--ca-hairline-strong)] ca-mono-label !text-[10px] text-[var(--ca-body)]">
                        Preview unavailable or access restricted.
                    </div>
                ) : isImage ? (
                    <img
                        src={src}
                        alt={node.label}
                        draggable
                        onDragStart={onDragStart}
                        className="block max-h-[360px] w-full cursor-grab object-contain bg-[repeating-conic-gradient(var(--ca-hairline-soft)_0%_25%,var(--ca-canvas-soft)_0%_50%)] bg-[size:18px_18px] active:cursor-grabbing"
                    />
                ) : (
                    <iframe src={src} title={node.label} className="block h-[360px] w-full border-0 bg-[var(--ca-canvas-soft)]" />
                )}
                {isImage && (
                    <div className="mt-3 flex items-center justify-between ca-mono-label !text-[9px] text-[var(--ca-success)]">
                        <span>DRAG IMAGE ONTO THE MAP TO ADD AS A NODE</span>
                        <a href={src} target="_blank" rel="noreferrer" className="text-[var(--ca-primary)] no-underline hover:underline">
                            OPEN
                        </a>
                    </div>
                )}
                {isPdf && (
                    <div className="mt-3 text-right ca-mono-label !text-[9px] tracking-[.08em]">
                        <a href={src} target="_blank" rel="noreferrer" className="text-[var(--ca-primary)] no-underline hover:underline">
                            OPEN PDF
                        </a>
                    </div>
                )}
            </div>
        </div>
    );
}

export default ImagePreview;
