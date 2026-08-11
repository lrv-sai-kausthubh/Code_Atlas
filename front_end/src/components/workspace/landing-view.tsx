import type { DragEvent } from "react";
import type { GitHubRepo } from "../../services/api";
import GithubConnect from "./github-connect";

function LandingView({
    dragging,
    error,
    githubUrl,
    githubToken,
    onBrowse,
    onDragOver,
    onDragLeave,
    onDrop,
    onGitHubUrlChange,
    onGitHubImport,
    onGitHubRepoImport,
}: {
    dragging: boolean;
    error: string;
    githubUrl: string;
    githubToken: string;
    onBrowse: () => void;
    onDragOver: (event: DragEvent) => void;
    onDragLeave: () => void;
    onDrop: (event: DragEvent) => void;
    onGitHubUrlChange: (value: string) => void;
    onGitHubImport: () => void;
    onGitHubRepoImport: (repo: GitHubRepo) => void;
}) {
    return (
       <div className="relative w-full  overflow-hidden">
        <div className="pointer-events-none absolute -right-[250px] top-[40px] h-[490px] w-[490px] rounded-full border border-[var(--ca-hairline)] max-[1000px]:hidden" />
        <div className="pointer-events-none absolute -right-[390px] -top-[90px] h-[730px] w-[730px] rounded-full border border-[var(--ca-hairline-soft)] max-[1000px]:hidden" />
        <div className="relative mx-auto flex w-full max-w-[1180px] items-start justify-between gap-[72px] px-[30px] max-[1000px]:flex-col max-[1000px]:items-center max-[1000px]:gap-[44px] max-[1000px]:pt-[48px]">
          <section className="w-full max-w-[600px] min-w-0">
            <div className="ca-badge mb-[20px] inline-flex">Software architecture</div>
            <h1 className="ca-display-lg m-0 text-[clamp(42px,4vw,72px)]">
                See how your code
                <br />
                <span className="text-[var(--ca-primary)]">actually works.</span>
            </h1>
            <p className="my-[24px] mb-9 max-w-[420px] text-[16px] leading-[1.6] text-[var(--ca-body)]">
                Upload a repository and CodeAtlas will map its files, dependencies and
                architecture into an interactive visual graph.
            </p>
            <button
                className={`mt-6 flex w-full max-w-[570px] min-h-[210px] flex-col items-center justify-center gap-[8px] rounded-[12px] border border-dashed border-2 border-[var(--ca-hairline-strong)] bg-[var(--ca-surface-card)] text-[var(--ca-ink)] transition-[background,border-color] duration-200 hover:border-[var(--ca-primary)] hover:bg-[var(--ca-canvas-soft)] ${dragging ? "border-[var(--ca-primary)] bg-[var(--ca-canvas-soft)]" : ""}`}
                onClick={onBrowse}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
            >
                <span className="ca-mono text-[13px] text-[var(--ca-primary)]">
                    {dragging ? "Drop to map" : "or drop a .zip file here"}
                </span>
                <span className="ca-mono-label !text-[12px]">max 200 MB</span>
            </button>
            {error && <p className="ca-mono mt-3 text-xs text-[var(--ca-error)]">{error}</p>}
          
        </section>

        <div className="flex w-full max-w-[480px] min-w-0 flex-col">
          <div className="flex w-full gap-2">
                <input
                    type="text"
                    value={githubUrl}
                    onChange={(event) => onGitHubUrlChange(event.target.value)}
                    onKeyDown={(event) => {
                        if (event.key === "Enter") onGitHubImport();
                    }}
                    placeholder="https://github.com/owner/repository"
                    className="ca-input min-w-0 flex-1 font-mono text-[13px]"
                />
                <button
                    type="button"
                    onClick={onGitHubImport}
                    disabled={!githubUrl.trim()}
                    className="ca-btn-secondary !font-mono !text-[13px]"
                >
                    Import
                </button>
            </div>
            <div className="mt-4 w-full max-w-[570px]">
                <GithubConnect token={githubToken} onImport={onGitHubRepoImport} />
            </div>
            <div className="mt-auto flex gap-[34px] pt-[38px]">
                <span className="ca-mono-label flex items-center gap-2">
                    <span className="grid h-4 w-4 place-items-center rounded-full bg-[var(--ca-surface-strong)] text-[9px] text-[var(--ca-ink)]">1</span>
                    Upload archive
                </span>
                <span className="ca-mono-label flex items-center gap-2">
                    <span className="grid h-4 w-4 place-items-center rounded-full bg-[var(--ca-surface-strong)] text-[9px] text-[var(--ca-ink)]">2</span>
                    Analyze structure
                </span>
                <span className="ca-mono-label flex items-center gap-2">
                    <span className="grid h-4 w-4 place-items-center rounded-full bg-[var(--ca-surface-strong)] text-[9px] text-[var(--ca-ink)]">3</span>
                    Explore graph
                </span>
            </div>
       </div>
       </div>
       </div>
    );
}

export default LandingView;