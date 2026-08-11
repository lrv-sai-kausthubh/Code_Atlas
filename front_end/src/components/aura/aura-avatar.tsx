import type { AuraEmotion } from "../../types/project";

const EYE = "#072b26";
const FEATURE = "#08342d";

type Face = {
    tint: string;
    eyes: "neutral" | "happy" | "wide" | "up";
    brows: "none" | "concerned" | "flat";
    mouth: "smile" | "excited" | "flat" | "frown" | "o" | "open";
};

const FACES: Record<AuraEmotion, Face> = {
    neutral: { tint: "#64d5c4", eyes: "neutral", brows: "none", mouth: "smile" },
    happy: { tint: "#64d5c4", eyes: "happy", brows: "none", mouth: "smile" },
    excited: { tint: "#f2b84b", eyes: "happy", brows: "none", mouth: "excited" },
    concerned: { tint: "#f2a34b", eyes: "neutral", brows: "concerned", mouth: "flat" },
    alert: { tint: "#f17c71", eyes: "wide", brows: "flat", mouth: "o" },
    thinking: { tint: "#7fa4ff", eyes: "up", brows: "none", mouth: "flat" },
    sad: { tint: "#7fa4ff", eyes: "neutral", brows: "concerned", mouth: "frown" },
    listening: { tint: "#64d5c4", eyes: "neutral", brows: "none", mouth: "smile" },
};

function Eyes({ face }: { face: Face }) {
    if (face.eyes === "happy") {
        return (
            <g className="aura-eyes" fill="none" stroke={EYE} strokeWidth="4" strokeLinecap="round">
                <path d="M33 47 Q38 40 43 47" />
                <path d="M57 47 Q62 40 67 47" />
            </g>
        );
    }
    if (face.eyes === "wide") {
        return (
            <g className="aura-eyes" fill={EYE}>
                <circle cx="38" cy="46" r="5.5" />
                <circle cx="62" cy="46" r="5.5" />
            </g>
        );
    }
    if (face.eyes === "up") {
        return (
            <g className="aura-eyes" fill={EYE}>
                <circle cx="38" cy="43" r="4.2" />
                <circle cx="62" cy="43" r="4.2" />
            </g>
        );
    }
    return (
        <g className="aura-eyes" fill={EYE}>
            <circle cx="38" cy="47" r="4.2" />
            <circle cx="62" cy="47" r="4.2" />
        </g>
    );
}

function Brows({ face }: { face: Face }) {
    if (face.brows === "concerned") {
        return (
            <g className="aura-brows" fill="none" stroke={FEATURE} strokeWidth="3" strokeLinecap="round">
                <path d="M31 40 L44 34" />
                <path d="M56 34 L69 40" />
            </g>
        );
    }
    if (face.brows === "flat") {
        return (
            <g className="aura-brows" fill="none" stroke={FEATURE} strokeWidth="3" strokeLinecap="round">
                <path d="M32 36 L44 36" />
                <path d="M56 36 L68 36" />
            </g>
        );
    }
    return null;
}

function Mouth({ face, speaking }: { face: Face; speaking: boolean }) {
    const className = `aura-mouth${speaking ? " aura-mouth-speaking" : ""}`;
    if (face.mouth === "smile") {
        return (
            <path className={className} d="M44 60 Q50 66 56 60" fill="none" stroke={FEATURE} strokeWidth="3.5" strokeLinecap="round" />
        );
    }
    if (face.mouth === "excited") {
        return (
            <path className={className} d="M36 57 Q50 73 64 57" fill="none" stroke={FEATURE} strokeWidth="3.5" strokeLinecap="round" />
        );
    }
    if (face.mouth === "flat") {
        return <path className={className} d="M43 62 L57 62" stroke={FEATURE} strokeWidth="3.5" strokeLinecap="round" />;
    }
    if (face.mouth === "frown") {
        return <path className={className} d="M43 65 Q50 57 57 65" fill="none" stroke={FEATURE} strokeWidth="3.5" strokeLinecap="round" />;
    }
    if (face.mouth === "o") {
        return <ellipse className={className} cx="50" cy="60" rx="4.5" ry="6" fill={FEATURE} />;
    }
    return (
        <g className={className}>
            <ellipse cx="50" cy="60" rx="5" ry="3" fill={FEATURE} />
            <ellipse cx="50" cy="60" rx="4" ry="7" fill="#0a1f1a" />
        </g>
    );
}

function Decoration({ emotion }: { emotion: AuraEmotion }) {
    if (emotion === "excited") {
        return (
            <g stroke="#f6d47a" strokeWidth="2.4" strokeLinecap="round">
                <path className="aura-spark" d="M78 26 l0 -7 M74.5 22.5 l7 0" />
                <path className="aura-spark" d="M24 30 l0 -6 M21 27 l6 0" />
                <path className="aura-spark" d="M80 62 l0 -5 M77.5 59.5 l5 0" />
            </g>
        );
    }
    if (emotion === "thinking") {
        return (
            <g fill="#7fa4ff">
                <circle className="aura-think-dot" cx="72" cy="30" r="3" />
                <circle className="aura-think-dot" cx="80" cy="24" r="3" />
                <circle className="aura-think-dot" cx="86" cy="16" r="3" />
            </g>
        );
    }
    return null;
}

export default function AuraAvatar({
    emotion = "neutral",
    speaking = false,
    size = 56,
}: {
    emotion?: AuraEmotion;
    speaking?: boolean;
    size?: number;
}) {
    const face = FACES[emotion] ?? FACES.neutral;
    return (
        <div
            className={`aura-avatar aura-${emotion}${speaking ? " aura-speaking" : ""}`}
            style={{ width: size, height: size, "--aura-tint": face.tint } as React.CSSProperties}
            aria-label={`Aura is ${emotion}`}
        >
            <div className="aura-orb">
                <svg viewBox="0 0 100 100" role="img">
                    <defs>
                        <radialGradient id="auraCore" cx="50%" cy="34%" r="70%">
                            <stop offset="0%" stopColor="#bdf4e4" />
                            <stop offset="55%" stopColor="#64d5c4" />
                            <stop offset="100%" stopColor="#1d8f7d" />
                        </radialGradient>
                    </defs>
                    <circle cx="50" cy="50" r="46" fill="url(#auraCore)" />
                    <circle cx="50" cy="50" r="46" fill="none" stroke="color-mix(in srgb, var(--aura-tint, #64d5c4) 55%, transparent)" strokeWidth="2" opacity=".6" />
                    <Eyes face={face} />
                    <Brows face={face} />
                    <Mouth face={face} speaking={speaking} />
                    <Decoration emotion={emotion} />
                </svg>
            </div>
        </div>
    );
}
