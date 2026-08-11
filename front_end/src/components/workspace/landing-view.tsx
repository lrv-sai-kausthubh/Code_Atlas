import type { DragEvent } from "react";
import { useState } from "react";
import type { GitHubRepo } from "../../services/api";
import GithubConnect from "./github-connect";
import AlertBanner from "../alert-banner";
import { FileArchive, FolderTree, Network, ShieldCheck, Sparkles, UploadCloud } from "lucide-react";

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
    const [dismissedFor, setDismissedFor] = useState("");
    const FEATURES = [
        {
            icon: FolderTree,
            title: "Interactive maps",
            text: "Drag, rename and reorganize the tree, delete files or add local ones, then export the edited project as ZIP or JSON.",
        },
        {
            icon: Sparkles,
            title: "Aura 1.0 copilot",
            text: "Ask about architecture, imports and dependencies — answered offline from your real project graph.",
        },
        {
            icon: Network,
            title: "Import & cycle analysis",
            text: "Dependencies, cycles, orphan files and health scores computed per repository.",
        },
        {
            icon: ShieldCheck,
            title: "Access control",
            text: "Policy-based grants, restricted source, access requests and audit trails.",
        },
    ];
    return (
       <div className="relative w-full overflow-hidden">
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
                architecture into an interactive visual graph you can edit and export.
            </p>
            <button
                className={`group mt-6 flex w-full max-w-[570px] min-h-[210px] flex-col items-center justify-center gap-4 rounded-[16px] border-2 border-dashed border-[var(--ca-hairline-strong)] bg-[var(--ca-surface-card)] px-6 py-10 text-center transition-[background,border-color] duration-200 hover:border-[var(--ca-primary)] hover:bg-[var(--ca-canvas-soft)] ${dragging ? "border-[var(--ca-primary)] bg-[var(--ca-canvas-soft)]" : ""}`}
                onClick={onBrowse}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
            >
                <span className="grid h-12 w-12 place-items-center rounded-2xl border border-[color-mix(in_srgb,var(--ca-primary)_35%,transparent)] bg-[color-mix(in_srgb,var(--ca-primary)_10%,var(--ca-surface-card))] text-[var(--ca-primary)] transition-transform duration-200 group-hover:-translate-y-0.5">
                    {dragging ? (
                        <FileArchive size={22} strokeWidth={1.8} />
                    ) : (
                        <UploadCloud size={22} strokeWidth={1.8} />
                    )}
                </span>
                <span className="flex flex-col gap-1">
                    <span className="text-[15px] font-medium text-[var(--ca-ink)]">
                        {dragging ? "Drop to map it" : "Upload your repository"}
                    </span>
                    <span className="ca-mono-label !text-[11px] text-[var(--ca-muted)]">
                        .zip up to 200 MB — or paste a GitHub URL below
                    </span>
                </span>
                <span className="ca-mono-label mt-1 rounded-full border border-[var(--ca-hairline)] bg-[var(--ca-canvas-soft)] px-3 py-1 text-[10px] text-[var(--ca-primary)]">
                    BROWSE FILES
                </span>
            </button>
            {error && dismissedFor !== error && (
                <div className="mt-4 max-w-[570px]">
                    <AlertBanner
                        kind="error"
                        title="Could not import this project"
                        onDismiss={() => setDismissedFor(error)}
                    >
                        {error}
                    </AlertBanner>
                </div>
            )}

            <div className="mt-8 grid max-w-[570px] grid-cols-2 gap-3">
                {FEATURES.map((feature) => (
                    <div
                        key={feature.title}
                        className="rounded-xl border border-[var(--ca-hairline)] bg-[var(--ca-surface-card)] p-4 transition-colors hover:border-[var(--ca-hairline-strong)]"
                    >
                        <feature.icon
                            size={16}
                            strokeWidth={1.8}
                            className="text-[var(--ca-primary)]"
                        />
                        <div className="mt-2.5 text-[12.5px] font-medium text-[var(--ca-ink)]">
                            {feature.title}
                        </div>
                        <p className="mt-1 text-[11.5px] leading-[1.55] text-[var(--ca-muted)]">
                            {feature.text}
                        </p>
                    </div>
                ))}
            </div>
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