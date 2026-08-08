import type { CSSProperties } from "react";
import type { RepositoryAnalysis } from "../../types/project";
import { formatBytes } from "../atlas/file-utils";

function AnalysisDrawer({ analysis }: { analysis: RepositoryAnalysis }) {
    const scoreColor =
        analysis.health_score >= 80
            ? "#64d5c4"
            : analysis.health_score >= 60
                ? "#f2b84b"
                : "#f17c71";
    const issues = analysis.security_issues ?? [];
    return (
        <section className="flex-[0_0_auto] overflow-y-auto p-[18px] bg-[color-mix(in_srgb,var(--graph-surface)_96%,#64d5c4)] light:bg-[#f6f8f5]">
            <div className="flex items-center gap-4">
                <div
                    className="health-score"
                    style={
                        {
                            "--score-color": scoreColor,
                            "--score-angle": `${analysis.health_score * 3.6}deg`,
                        } as CSSProperties
                    }
                >
                    <strong>{analysis.health_score}</strong>
                    <span>/ 100</span>
                </div>
                <div>
                    <p className="m-0 font-dm text-[9px] tracking-[.1em] text-[#64d5c4]">
                        ARCHITECTURE HEALTH
                    </p>
                    <h2 className="my-1 text-lg text-[var(--graph-label)] light:text-[#34473f]">
                        {analysis.health_score >= 80
                            ? "Healthy foundation"
                            : analysis.health_score >= 60
                                ? "Worth investigating"
                                : "Needs attention"}
                    </h2>
                    <p className="m-0 font-dm text-[9px] text-[var(--graph-label)] opacity-80">
                        Calculated from dependency cycles, orphan files, oversized modules,
                        and hardcoded secrets.
                    </p>
                </div>
            </div>
            <div className="mt-[18px] grid grid-cols-4 gap-[7px] max-[850px]:grid-cols-2">
                <div className="border border-[color-mix(in_srgb,var(--graph-edge)_70%,transparent)] p-[11px]">
                    <span className="block font-dm text-[8px] text-[var(--graph-label)]">
                        LINES OF CODE
                    </span>
                    <strong className="mt-[7px] block font-dm text-base text-[#f2b84b] light:text-[#34473f]">
                        {analysis.total_lines.toLocaleString()}
                    </strong>
                </div>
                <div className="border border-[color-mix(in_srgb,var(--graph-edge)_70%,transparent)] p-[11px]">
                    <span className="block font-dm text-[8px] text-[var(--graph-label)]">
                        IMPORTS
                    </span>
                    <strong className="mt-[7px] block font-dm text-base text-[#f2b84b] light:text-[#34473f]">
                        {analysis.total_imports}
                    </strong>
                </div>
                <div className="border border-[color-mix(in_srgb,var(--graph-edge)_70%,transparent)] p-[11px]">
                    <span className="block font-dm text-[8px] text-[var(--graph-label)]">
                        AVG DEPENDENCIES
                    </span>
                    <strong className="mt-[7px] block font-dm text-base text-[#f2b84b] light:text-[#34473f]">
                        {analysis.average_dependencies}
                    </strong>
                </div>
                <div className="border border-[color-mix(in_srgb,var(--graph-edge)_70%,transparent)] p-[11px]">
                    <span className="block font-dm text-[8px] text-[var(--graph-label)]">
                        LONGEST CHAIN
                    </span>
                    <strong className="mt-[7px] block font-dm text-base text-[#f2b84b] light:text-[#34473f]">
                        {analysis.longest_import_chain.length} files
                    </strong>
                </div>
            </div>
            <div className="mt-[7px] grid grid-cols-3 gap-[7px] max-[850px]:grid-cols-1">
                <div className="min-w-0 border-t border-[color-mix(in_srgb,var(--graph-edge)_70%,transparent)] px-[11px] py-[10px]">
                    <span className="block font-dm text-[9px] text-[var(--graph-label)]">
                        CIRCULAR DEPENDENCIES
                    </span>
                    <strong
                        className={`my-[6px] block truncate font-dm text-[11px] text-[var(--graph-label)] light:text-[#34473f] ${analysis.circular_dependencies.length ? "text-[#f17c71]" : "text-[#64d5c4]"}`}
                    >
                        {analysis.circular_dependencies.length || "None detected"}
                    </strong>
                    {analysis.circular_dependencies.length > 0 && (
                        <small className="m-0 block truncate font-dm text-[9px] text-[var(--graph-label)]">
                            {analysis.circular_dependencies[0].join(" → ")}
                        </small>
                    )}
                </div>
                <div className="min-w-0 border-t border-[color-mix(in_srgb,var(--graph-edge)_70%,transparent)] px-[11px] py-[10px]">
                    <span className="block font-dm text-[9px] text-[var(--graph-label)]">
                        ORPHAN FILES
                    </span>
                    <strong
                        className={`my-[6px] block truncate font-dm text-[11px] text-[var(--graph-label)] light:text-[#34473f] ${analysis.orphan_files.length ? "text-[#f2b84b]" : "text-[#64d5c4]"}`}
                    >
                        {analysis.orphan_files.length}
                    </strong>
                    {analysis.orphan_files.length > 0 && (
                        <small className="m-0 block truncate font-dm text-[9px] text-[var(--graph-label)]">
                            {analysis.orphan_files.slice(0, 2).join(" · ")}
                            {analysis.orphan_files.length > 2 ? " · ..." : ""}
                        </small>
                    )}
                </div>
                <div className="min-w-0 border-t border-[color-mix(in_srgb,var(--graph-edge)_70%,transparent)] px-[11px] py-[10px]">
                    <span className="block font-dm text-[9px] text-[var(--graph-label)]">
                        LARGEST FILE
                    </span>
                    <strong className="my-[6px] block truncate font-dm text-[11px] text-[var(--graph-label)] light:text-[#34473f]">
                        {analysis.largest_file?.path ?? "-"}
                    </strong>
                    <small className="m-0 block truncate font-dm text-[9px] text-[var(--graph-label)]">
                        {analysis.largest_file
                            ? `${analysis.largest_file.lines.toLocaleString()} lines · ${formatBytes(analysis.largest_file.size_bytes)}`
                            : "No files"}
                    </small>
                </div>
            </div>
            <div className="mt-[7px] border-t border-[color-mix(in_srgb,var(--graph-edge)_70%,transparent)] pt-3">
                <div className="flex items-baseline gap-[10px]">
                    <span className="block font-dm text-[9px] text-[var(--graph-label)]">
                        HARDCODED SECRETS
                    </span>
                    <strong className={`font-dm text-[11px] ${issues.length ? "text-[#f17c71]" : "text-[#64d5c4]"}`}>
                        {issues.length ? `${issues.length} found` : "None detected"}
                    </strong>
                </div>
                {issues.length > 0 && (
                    <ul className="mt-[10px] mb-0 flex list-none flex-col gap-1.5 p-0">
                        {issues.slice(0, 12).map((issue, index) => (
                            <li
                                key={index}
                                className="flex items-center gap-[10px] border-l-2 border-[#f17c71] bg-[color-mix(in_srgb,var(--graph-surface)_70%,#f17c71)] px-[10px] py-2"
                            >
                                <span className="shrink-0 font-dm text-[9px] text-[#f17c71]">
                                    {issue.type}
                                </span>
                                <span className="shrink-0 font-dm text-[9px] text-[var(--graph-label)] opacity-80">
                                    {issue.file}:{issue.line}
                                </span>
                                <code className="min-w-0 flex-1 truncate font-dm text-[10px] text-[var(--graph-label)]">
                                    {issue.snippet}
                                </code>
                            </li>
                        ))}
                    </ul>
                )}
                {issues.length > 12 && (
                    <small className="mt-1.5 block font-dm text-[9px] text-[var(--graph-label)] opacity-60">
                        +{issues.length - 12} more hidden
                    </small>
                )}
            </div>
        </section>
    );
}

export default AnalysisDrawer;
