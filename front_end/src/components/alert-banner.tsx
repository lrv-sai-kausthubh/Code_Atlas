import type { LucideIcon } from "lucide-react";
import { AlertCircle, CheckCircle2, Info, TriangleAlert, X } from "lucide-react";
import type { ReactNode } from "react";

type AlertKind = "error" | "warning" | "info" | "success";

const KIND_META: Record<
    AlertKind,
    { icon: LucideIcon; tint: string; iconColor: string }
> = {
    error: { icon: AlertCircle, tint: "var(--ca-error)", iconColor: "var(--ca-error)" },
    warning: { icon: TriangleAlert, tint: "#c08532", iconColor: "#c08532" },
    info: { icon: Info, tint: "var(--ca-primary)", iconColor: "var(--ca-primary)" },
    success: { icon: CheckCircle2, tint: "var(--ca-success)", iconColor: "var(--ca-success)" },
};

type AlertBannerProps = {
    kind?: AlertKind;
    title?: string;
    children: ReactNode;
    onDismiss?: () => void;
};

export default function AlertBanner({
    kind = "info",
    title,
    children,
    onDismiss,
}: AlertBannerProps) {
    const meta = KIND_META[kind];
    return (
        <div
            className="flex items-start gap-3 rounded-xl border p-4 text-left"
            style={{
                borderColor: `color-mix(in_srgb,${meta.tint} 35%,transparent)`,
                background: `color-mix(in_srgb,${meta.tint} 8%,var(--ca-surface-card))`,
            }}
        >
            <meta.icon
                size={18}
                strokeWidth={2}
                className="mt-px shrink-0"
                style={{ color: meta.iconColor }}
            />
            <div className="min-w-0 flex-1 text-[13px] leading-[1.55] text-[var(--ca-body)]">
                {title && (
                    <p className="m-0 mb-1 font-medium text-[var(--ca-ink)]">{title}</p>
                )}
                {children}
            </div>
            {onDismiss && (
                <button
                    className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-[var(--ca-muted)] transition-colors hover:bg-[var(--ca-surface-strong)] hover:text-[var(--ca-ink)]"
                    onClick={onDismiss}
                    aria-label="Dismiss"
                >
                    <X size={14} />
                </button>
            )}
        </div>
    );
}