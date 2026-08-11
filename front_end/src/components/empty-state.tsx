import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

type EmptyStateProps = {
    icon?: LucideIcon;
    title: string;
    description?: string;
    actions?: ReactNode;
    compact?: boolean;
};

export default function EmptyState({
    icon: Icon,
    title,
    description,
    actions,
    compact,
}: EmptyStateProps) {
    return (
        <div
            className={`flex flex-col items-center justify-center text-center ${
                compact ? "gap-2 px-4 py-5" : "gap-4 px-6 py-16"
            }`}
        >
            {Icon && (
                <div
                    className={`grid place-items-center rounded-2xl border border-dashed border-[var(--ca-hairline-strong)] bg-[color-mix(in_srgb,var(--ca-primary)_8%,var(--ca-surface-card))] ${
                        compact ? "h-11 w-11" : "h-14 w-14"
                    }`}
                >
                    <Icon
                        size={compact ? 20 : 26}
                        strokeWidth={1.8}
                        className="text-[var(--ca-primary)]"
                    />
                </div>
            )}
            <div
                className={`flex flex-col items-center ${compact ? "gap-1" : "gap-1.5"}`}
            >
                <p
                    className={`m-0 font-medium text-[var(--ca-ink)] ${
                        compact ? "text-[13px]" : "text-[15px]"
                    }`}
                >
                    {title}
                </p>
                {description && (
                    <p
                        className={`m-0 max-w-[340px] text-[var(--ca-muted)] ${
                            compact ? "text-[11px]" : "text-[13px]"
                        }`}
                    >
                        {description}
                    </p>
                )}
            </div>
            {actions && (
                <div className="flex flex-wrap items-center justify-center gap-2.5">
                    {actions}
                </div>
            )}
        </div>
    );
}