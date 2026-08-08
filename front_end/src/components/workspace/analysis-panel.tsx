import AnalysisDrawer from "../analysis/analysis-drawer";
import { LIVE_DOT, PANEL, PANEL_COLLAPSE } from "./panel-classes";
import type { RepositoryAnalysis } from "../../types/project";

function AnalysisPanel({
    analysis,
    onClose,
}: {
    analysis: RepositoryAnalysis;
    onClose: () => void;
}) {
    return (
        <div className={`${PANEL} flex h-[var(--analysis-height,240px)] min-h-0 flex-col overflow-hidden col-start-3 row-start-3`}>
            <div className="flex h-9 flex-none items-center justify-between border-b border-[#2b3030] pl-5 pr-[14px] font-dm text-[10px] tracking-[.1em] text-[#b1bab5] light:border-[#d6dfda] light:text-[#71807a]">
                <div>
                    <span className={LIVE_DOT} /> ARCHITECTURE ANALYSIS
                </div>
                <button
                    className={PANEL_COLLAPSE}
                    onClick={onClose}
                    aria-label="Close analysis panel"
                >
                    <span className="material-symbols-outlined">close</span>
                </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
                <AnalysisDrawer analysis={analysis} />
            </div>
        </div>
    );
}

export default AnalysisPanel;
