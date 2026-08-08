function TopBar({
    theme,
    onToggleTheme,
    onToggleStateLab,
    onNewProject,
}: {
    theme: "dark" | "light";
    onToggleTheme: () => void;
    onToggleStateLab: () => void;
    onNewProject: () => void;
}) {
    return (
        <header className="relative z-[2] flex h-[72px] items-center justify-between border-b border-[#2b3030] px-[42px] light:border-[#d6dfda] max-[850px]:px-[18px]">
            <div className="flex items-center gap-[11px] font-dm text-[14px] font-medium tracking-[.16em] light:text-[#202824]">
                <span className="text-[22px] text-[#f2b84b]">✦</span>
                <span>CODEATLAS</span>
                <small className="ml-3 text-[9px] tracking-[.1em] text-[#777e7d] light:text-[#71807a] max-[850px]:hidden">
                    V1 / MILESTONE 1
                </small>
            </div>
            <div className="flex items-center gap-[27px] font-dm text-[11px]">
                <span className="text-[#7d8784] light:text-[#71807a] max-[850px]:hidden">
                    <i className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-[#64d5c4] shadow-[0_0_12px_#64d5c4]" />{" "}
                    API CONNECTED
                </span>
                <button
                    className="border border-[#596260] bg-transparent px-3 py-[10px] font-dm text-[10px] tracking-[.05em] text-[#aeb8b3] transition-colors hover:border-[#f2b84b] hover:text-[#f2b84b] light:border-[#b8c8c0] light:text-[#405149] max-[850px]:hidden"
                    onClick={onToggleTheme}
                    aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
                >
                    {theme === "dark" ? "☼ LIGHT" : "◐ DARK"}
                </button>
                <button
                    className="border border-[#596260] bg-transparent px-3 py-[10px] font-dm text-[10px] tracking-[.05em] text-[#aeb8b3] transition-colors hover:border-[#f2b84b] hover:text-[#f2b84b] light:border-[#b8c8c0] light:text-[#405149] max-[850px]:hidden"
                    onClick={onToggleStateLab}
                >
                    STATE LAB
                </button>
                <button
                    className="border border-[#596260] bg-transparent px-[14px] py-[10px] font-dm text-[11px] tracking-[.04em] text-[#eff0ed] transition-colors hover:border-[#f2b84b] hover:text-[#f2b84b] light:border-[#b8c8c0] light:text-[#202824]"
                    onClick={onNewProject}
                >
                    + NEW PROJECT
                </button>
            </div>
        </header>
    );
}

export default TopBar;
