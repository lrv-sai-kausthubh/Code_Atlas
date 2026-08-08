import { projectFileUrl } from "../../services/api";
import type { DragEvent } from "react";
import type { ProjectNode } from "../../types/project";
import { IMAGE_EXTENSIONS, PDF_EXTENSION } from "../atlas/file-utils";
import { IMAGE_DROP_MIME } from "../atlas/graph-canvas";
import type { ImageDropPayload } from "../atlas/graph-canvas";

function ImagePreview({
    node,
    projectId,
    onClose,
}: {
    node: ProjectNode;
    projectId: string;
    onClose: () => void;
}) {
    const extension = node.label.toLowerCase().split(".").pop() ?? "";
    const src = projectFileUrl(projectId, node.path);
    const isImage = IMAGE_EXTENSIONS.has(extension);
    const isPdf = extension === PDF_EXTENSION;
    if (!isImage && !isPdf) return null;

    const onDragStart = (event: DragEvent) => {
        const payload: ImageDropPayload = { src, node };
        event.dataTransfer.setData(IMAGE_DROP_MIME, JSON.stringify(payload));
        event.dataTransfer.effectAllowed = "copy";
    };

    return (
        <div className="fixed right-6 top-[84px] z-40 w-[420px] border border-[#2b3030] bg-[#171a1a] shadow-[0_24px_60px_rgba(0,0,0,.45)] light:border-[#d6dfda] light:bg-[#f6f8f5]">
            <div className="flex items-center justify-between border-b border-[#2b3030] px-[14px] py-3 font-dm text-[10px] tracking-[.1em] text-[#b1bab5] light:border-[#d6dfda] light:text-[#71807a]">
                <span className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[16px] text-[#f2b84b]">
                        {isImage ? "image" : "picture_as_pdf"}
                    </span>
                    IMAGE PREVIEW
                </span>
                <button
                    className="inline-flex h-[22px] w-[22px] items-center justify-center border border-transparent bg-transparent text-[#79817e] transition-colors hover:border-[#39413e] hover:text-[#f2b84b]"
                    onClick={onClose}
                    aria-label="Close preview"
                >
                    <span className="material-symbols-outlined text-[16px]">close</span>
                </button>
            </div>
            <div className="p-[14px]">
                <div className="mb-3 truncate font-dm text-[11px] text-[#dfe5df] light:text-[#202824]">
                    {node.label}
                </div>
                {isImage ? (
                    <img
                        src={src}
                        alt={node.label}
                        draggable
                        onDragStart={onDragStart}
                        className="block max-h-[360px] w-full cursor-grab object-contain bg-[repeating-conic-gradient(#14181a_0%_25%,#101314_0%_50%)] bg-[size:18px_18px] active:cursor-grabbing"
                    />
                ) : (
                    <iframe src={src} title={node.label} className="block h-[360px] w-full border-0 bg-[#dfe2eb]" />
                )}
                {isImage && (
                    <div className="mt-3 flex items-center justify-between font-dm text-[9px] tracking-[.08em] text-[#64d5c4]">
                        <span>DRAG IMAGE ONTO THE MAP TO ADD AS A NODE</span>
                        <a href={src} target="_blank" rel="noreferrer" className="text-[#f2b84b] no-underline hover:underline">
                            OPEN
                        </a>
                    </div>
                )}
                {isPdf && (
                    <div className="mt-3 text-right font-dm text-[9px] tracking-[.08em]">
                        <a href={src} target="_blank" rel="noreferrer" className="text-[#f2b84b] no-underline hover:underline">
                            OPEN PDF
                        </a>
                    </div>
                )}
            </div>
        </div>
    );
}

export default ImagePreview;
