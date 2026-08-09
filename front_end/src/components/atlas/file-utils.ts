import type { LucideIcon } from "lucide-react";
import {
    BookOpen,
    Braces,
    Code,
    Database,
    File,
    FileCode,
    FileText,
    FolderArchive,
    Image as ImageIcon,
    KeyRound,
    Palette,
    SlidersHorizontal,
} from "lucide-react";
import type { ProjectNode } from "../../types/project";

export function fileIcon(label: string): { Icon: LucideIcon; className: string } {
    const extension = label.toLowerCase().split(".").pop() ?? "";
    const icons: Record<string, { Icon: LucideIcon; className: string }> = {
        html: { Icon: FileCode, className: "text-[#ef8354]" },
        css: { Icon: Palette, className: "text-[#67a7f8]" },
        scss: { Icon: Palette, className: "text-[#67a7f8]" },
        js: { Icon: Braces, className: "text-[#e9c44a]" },
        jsx: { Icon: Braces, className: "text-[#e9c44a]" },
        ts: { Icon: Code, className: "text-[#5a9ee8]" },
        tsx: { Icon: Code, className: "text-[#5a9ee8]" },
        py: { Icon: Database, className: "text-[#d8bb55]" },
        json: { Icon: Braces, className: "text-[#bb9be9]" },
        md: { Icon: FileText, className: "text-[#b0bab4]" },
        svg: { Icon: ImageIcon, className: "text-[#ef9d56]" },
        png: { Icon: ImageIcon, className: "text-[#9ca9ff]" },
        jpg: { Icon: ImageIcon, className: "text-[#9ca9ff]" },
        jpeg: { Icon: ImageIcon, className: "text-[#9ca9ff]" },
        gif: { Icon: ImageIcon, className: "text-[#9ca9ff]" },
        webp: { Icon: ImageIcon, className: "text-[#9ca9ff]" },
        pdf: { Icon: BookOpen, className: "text-[#f17c71]" },
        zip: { Icon: FolderArchive, className: "text-[#bb9be9]" },
        tar: { Icon: FolderArchive, className: "text-[#bb9be9]" },
        gz: { Icon: FolderArchive, className: "text-[#bb9be9]" },
        txt: { Icon: File, className: "text-[#9ca9ff]" },
        yml: { Icon: SlidersHorizontal, className: "text-[#bb9be9]" },
        yaml: { Icon: SlidersHorizontal, className: "text-[#bb9be9]" },
        toml: { Icon: SlidersHorizontal, className: "text-[#bb9be9]" },
        lock: { Icon: KeyRound, className: "text-[#bb9be9]" },
    };
    return icons[extension] ?? { Icon: File, className: "text-[#b0bab4]" };
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
