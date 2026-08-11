import AnalysisDrawer from "../analysis/analysis-drawer";
import { LIVE_DOT, PANEL, PANEL_COLLAPSE } from "./panel-classes";
import { X } from "lucide-react";
import type { RepositoryAnalysis } from "../../types/project";

function AnalysisPanel({
    analysis,
    onClose,
}: {
    analysis: RepositoryAnalysis;
    onClose: () => void;
}) {
    return (
        <div className={`${PANEL} flex h-full min-h-0 flex-col overflow-hidden`}>
            <div className="flex h-9 flex-none items-center justify-between border-b border-[var(--ca-hairline)] pl-5 pr-[14px] ca-mono-label !text-[10px]">
                <div>
                    <span className={LIVE_DOT} /> Architecture analysis
                </div>
                <button
                    className={PANEL_COLLAPSE}
                    onClick={onClose}
                    aria-label="Close analysis panel"
                >
                    <X size={14} />
                </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
                <AnalysisDrawer analysis={analysis} />
            </div>
        </div>
    );
}

export default AnalysisPanel;
