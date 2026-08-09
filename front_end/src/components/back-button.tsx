import { useNavigation } from "../services/navigation";

function BackIcon() {
    return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M19 12H5" />
            <path d="m12 19-7-7 7-7" />
        </svg>
    );
}

type BackButtonProps = {
    label?: string;
    onClick?: () => void;
    variant?: "default" | "ghost";
};

function BackButton({ label = "BACK", onClick, variant = "default" }: BackButtonProps) {
    const { goBack } = useNavigation();
    const handleClick = onClick ?? goBack;
    if (variant === "ghost") {
        return (
            <button
                onClick={handleClick}
                aria-label="Go back"
                className="flex items-center gap-1.5 border border-[var(--graph-edge)] bg-[var(--graph-surface)] px-2 py-[6px] font-dm text-[9px] tracking-[.05em] text-[var(--graph-label)] transition-colors hover:border-[#f2b84b] hover:text-[#f2b84b] light:border-[#b8c8c0] light:bg-[#f6f8f5] light:text-[#405149]"
            >
                <BackIcon />
                {label}
            </button>
        );
    }
    return (
        <button
            onClick={handleClick}
            aria-label="Go back"
            className="flex items-center gap-2 border border-[#596260] bg-transparent px-3 py-[10px] font-dm text-[10px] tracking-[.08em] text-[#aeb8b3] transition-colors hover:border-[#f2b84b] hover:text-[#f2b84b] light:border-[#b8c8c0] light:text-[#405149]"
        >
            <BackIcon />
            {label}
        </button>
    );
}

export default BackButton;
