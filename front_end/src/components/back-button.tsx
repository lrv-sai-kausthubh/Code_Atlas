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

function BackButton({ label = "Back", onClick, variant = "default" }: BackButtonProps) {
    const { goBack } = useNavigation();
    const handleClick = onClick ?? goBack;
    if (variant === "ghost") {
        return (
            <button
                onClick={handleClick}
                aria-label="Go back"
                className="ca-btn-secondary !h-8 !px-3 ca-mono-label !text-[10px] !font-medium"
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
            className="ca-btn-secondary ca-mono-label !text-[11px] !font-medium"
        >
            <BackIcon />
            {label}
        </button>
    );
}

export default BackButton;