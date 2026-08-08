import type { ProjectNode } from "../../types/project";

export function fileIcon(label: string) {
    const extension = label.toLowerCase().split(".").pop() ?? "";
    const icons: Record<string, { name: string; className: string }> = {
        html: { name: "html", className: "text-[#ef8354]" },
        css: { name: "css", className: "text-[#67a7f8]" },
        scss: { name: "css", className: "text-[#67a7f8]" },
        js: { name: "javascript", className: "text-[#e9c44a]" },
        jsx: { name: "javascript", className: "text-[#e9c44a]" },
        ts: { name: "code", className: "text-[#5a9ee8]" },
        tsx: { name: "code", className: "text-[#5a9ee8]" },
        py: { name: "data_object", className: "text-[#d8bb55]" },
        json: { name: "data_object", className: "text-[#bb9be9]" },
        md: { name: "article", className: "text-[#b0bab4]" },
        svg: { name: "image", className: "text-[#ef9d56]" },
        png: { name: "image", className: "text-[#9ca9ff]" },
        jpg: { name: "image", className: "text-[#9ca9ff]" },
        jpeg: { name: "image", className: "text-[#9ca9ff]" },
        gif: { name: "image", className: "text-[#9ca9ff]" },
        webp: { name: "image", className: "text-[#9ca9ff]" },
        pdf: { name: "picture_as_pdf", className: "text-[#f17c71]" },
        zip: { name: "folder_zip", className: "text-[#bb9be9]" },
        tar: { name: "folder_zip", className: "text-[#bb9be9]" },
        gz: { name: "folder_zip", className: "text-[#bb9be9]" },
        txt: { name: "description", className: "text-[#9ca9ff]" },
        yml: { name: "tune", className: "text-[#bb9be9]" },
        yaml: { name: "tune", className: "text-[#bb9be9]" },
        toml: { name: "tune", className: "text-[#bb9be9]" },
        lock: { name: "enhanced_encryption", className: "text-[#bb9be9]" },
    };
    return icons[extension] ?? { name: "description", className: "text-[#b0bab4]" };
}

export const IMAGE_EXTENSIONS = new Set([
    "png",
    "jpg",
    "jpeg",
    "gif",
    "webp",
    "svg",
    "bmp",
    "ico",
    "avif",
]);

export const PDF_EXTENSION = "pdf";

export function isPreviewable(node: ProjectNode) {
    if (node.type !== "file") return false;
    const extension = node.label.toLowerCase().split(".").pop() ?? "";
    return IMAGE_EXTENSIONS.has(extension) || extension === PDF_EXTENSION;
}

export function formatBytes(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
