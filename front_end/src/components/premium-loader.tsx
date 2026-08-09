import { useEffect, useState } from "react";

const CYCLE_PHASES = [
    "READING POLICY",
    "RESOLVING IMPORTS",
    "BUILDING GRAPH",
    "INDEXING SYMBOLS",
    "CALIBRATING NODES",
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

export function AtlasLoader({ label = "LOADING WORKSPACE" }: { label?: string }) {
    const [phaseIndex, setPhaseIndex] = useState(0);
    useEffect(() => {
        const id = setInterval(
            () => setPhaseIndex((index) => (index + 1) % CYCLE_PHASES.length),
            1500,
        );
        return () => clearInterval(id);
    }, []);

    return (
        <div className="relative flex flex-1 flex-col items-center justify-center gap-7 overflow-hidden bg-[radial-gradient(circle_at_50%_28%,#15201e_0,transparent_58%),#101112] light:bg-[radial-gradient(circle_at_50%_28%,#dceae4_0,transparent_58%),#eef1ed]">
            <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#2a4a42_1px,transparent_1px)] bg-[size:26px_26px] light:bg-[radial-gradient(#7fa89c_1px,transparent_1px)]" />
            <div className="absolute h-[240px] w-[240px] rounded-full bg-[#64d5c4]/10 blur-[70px]" />
            <div className="relative">
                <svg width="248" height="216" viewBox="0 0 248 216" className="overflow-visible">
                    {EDGES.map(([from, to], index) => (
                        <line
                            key={index}
                            x1={NODES[from].x}
                            y1={NODES[from].y}
                            x2={NODES[to].x}
                            y2={NODES[to].y}
                            stroke="#64d5c4"
                            strokeOpacity="0.55"
                            strokeWidth="1"
                            className="loader-edge"
                            style={{ animationDelay: `${index * 0.14}s` }}
                        />
                    ))}
                    {NODES.map((node, index) => (
                        <g key={index} className="loader-node" style={{ animationDelay: `${index * 0.2}s` }}>
                            <circle cx={node.x} cy={node.y} r="11" fill="#101715" stroke="#64d5c4" strokeWidth="1.5" />
                            <circle cx={node.x} cy={node.y} r="3" fill="#64d5c4" />
                        </g>
                    ))}
                </svg>
            </div>
            <div className="relative flex flex-col items-center gap-2.5">
                <div className="font-dm text-[10px] tracking-[.3em] text-[#64d5c4] light:text-[#398f83]">
                    {label}
                </div>
                <div className="flex items-center gap-1 font-dm text-[10px] tracking-[.22em] text-[#6d7974] light:text-[#61716a]">
                    <span>{CYCLE_PHASES[phaseIndex]}</span>
                    <span className="loader-caret text-[#f2b84b]">▌</span>
                </div>
                <div className="mt-1.5 h-[2px] w-[230px] overflow-hidden bg-[#1c2422] light:bg-[#d3ddd6]">
                    <div className="loader-shimmer h-full w-1/3 bg-[linear-gradient(90deg,transparent,#64d5c4,transparent)]" />
                </div>
            </div>
        </div>
    );
}

export function InlineLoader({ label = "LOADING…" }: { label?: string }) {
    return (
        <div className="flex items-center gap-2.5 font-dm text-[11px] text-[#79817e] light:text-[#61716a]">
            <span className="flex gap-1.5">
                {[0, 1, 2].map((index) => (
                    <span
                        key={index}
                        className="inline-block h-1.5 w-1.5 bg-[#64d5c4]"
                        style={{ animation: `ca-pulse 1.1s ease-in-out ${index * 0.18}s infinite` }}
                    />
                ))}
            </span>
            {label}
        </div>
    );
}
