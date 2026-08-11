import { useEffect, useState } from "react";

const CYCLE_PHASES = [
    "Reading policy",
    "Resolving imports",
    "Building graph",
    "Indexing symbols",
    "Calibrating nodes",
];

const NODES = [
    { x: 120, y: 44 },
    { x: 40, y: 104 },
    { x: 200, y: 104 },
    { x: 76, y: 170 },
    { x: 164, y: 170 },
    { x: 120, y: 120 },
];

const EDGES: [number, number][] = [
    [0, 1],
    [0, 2],
    [0, 5],
    [1, 3],
    [2, 4],
    [3, 4],
    [5, 3],
    [5, 4],
];

export function AtlasLoader({ label = "Loading workspace" }: { label?: string }) {
    const [phaseIndex, setPhaseIndex] = useState(0);
    useEffect(() => {
        const id = setInterval(
            () => setPhaseIndex((index) => (index + 1) % CYCLE_PHASES.length),
            1500,
        );
        return () => clearInterval(id);
    }, []);

    return (
        <div className="relative flex flex-1 flex-col items-center justify-center gap-7 overflow-hidden bg-[var(--ca-canvas)]">
            <div className="absolute inset-0 opacity-40 bg-[radial-gradient(var(--ca-hairline)_1px,transparent_1px)] bg-[size:26px_26px]" />
            <div className="relative">
                <svg width="248" height="216" viewBox="0 0 248 216" className="overflow-visible">
                    {EDGES.map(([from, to], index) => (
                        <line
                            key={index}
                            x1={NODES[from].x}
                            y1={NODES[from].y}
                            x2={NODES[to].x}
                            y2={NODES[to].y}
                            stroke="var(--ca-primary)"
                            strokeOpacity="0.55"
                            strokeWidth="1"
                            className="loader-edge"
                            style={{ animationDelay: `${index * 0.14}s` }}
                        />
                    ))}
                    {NODES.map((node, index) => (
                        <g key={index} className="loader-node" style={{ animationDelay: `${index * 0.2}s` }}>
                            <circle cx={node.x} cy={node.y} r="11" fill="var(--ca-surface-card)" stroke="var(--ca-primary)" strokeWidth="1.5" />
                            <circle cx={node.x} cy={node.y} r="3" fill="var(--ca-primary)" />
                        </g>
                    ))}
                </svg>
            </div>
            <div className="relative flex flex-col items-center gap-2.5">
                <div className="ca-label">{label}</div>
                <div className="ca-mono-label flex items-center gap-1">
                    <span>{CYCLE_PHASES[phaseIndex]}</span>
                    <span className="loader-caret text-[var(--ca-primary)]">▌</span>
                </div>
                <div className="mt-1.5 h-[2px] w-[230px] overflow-hidden bg-[var(--ca-surface-strong)]">
                    <div className="loader-shimmer h-full w-1/3 bg-[linear-gradient(90deg,transparent,var(--ca-primary),transparent)]" />
                </div>
            </div>
        </div>
    );
}

export function InlineLoader({ label = "Loading…" }: { label?: string }) {
    return (
        <div className="ca-mono-label flex items-center gap-2.5">
            <span className="flex gap-1.5">
                {[0, 1, 2].map((index) => (
                    <span
                        key={index}
                        className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--ca-primary)]"
                        style={{ animation: `ca-pulse 1.1s ease-in-out ${index * 0.18}s infinite` }}
                    />
                ))}
            </span>
            {label}
        </div>
    );
}