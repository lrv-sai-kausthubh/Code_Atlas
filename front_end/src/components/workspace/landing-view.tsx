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
       <div className="relative w-full overflow-hidden">
       <div className="pointer-events-none absolute -right-[250px] top-[40px] h-[490px] w-[490px] rounded-full border border-[#253a37] light:border-[#cbded6] max-[1000px]:hidden" />
       <div className="pointer-events-none absolute -right-[390px] -top-[90px] h-[730px] w-[730px] rounded-full border border-[#202e2c] light:border-[#cbded6] max-[1000px]:hidden" />
       <div className="relative mx-auto flex w-full max-w-[1180px] items-start justify-center gap-[72px] px-[30px] pb-[60px] pt-[90px] max-[1000px]:flex-col max-[1000px]:items-center max-[1000px]:gap-[44px] max-[1000px]:pt-[56px]">
         <section className="w-full max-w-[600px] min-w-0">
            <div className="mb-[25px] font-dm text-[11px] tracking-[.14em] text-[#64d5c4]">
                SOFTWARE ARCHITECTURE / 001
            </div>
            <h1 className="m-0 font-semibold leading-[.94] tracking-[-.07em] text-[clamp(50px,8vw,92px)] light:text-[#202824]">
                See the shape
                <br />
                <em className="text-[#f2b84b] not-italic">of your code.</em>
            </h1>
            <p className="my-[30px] mb-9 max-w-[410px] text-[15px] leading-[1.6] text-[#929a96] light:text-[#61716a]">
                Upload a project archive and turn its structure into a living map.
                Start with the files. Discover the system.
            </p>
            <button
                className="relative flex w-full max-w-[570px] min-h-[190px] flex-col items-center justify-center gap-[10px] border border-dashed border-[#626b66] bg-[rgba(27,33,32,.6)] text-[#eef0eb] transition-[background,border-color] duration-200 hover:border-[#64d5c4] hover:bg-[rgba(48,82,77,.22)] light:border-[#8ba49a] light:bg-[rgba(246,248,245,.86)] light:text-[#202824] light:hover:border-[#398f83] light:hover:bg-[#e3ece7]"
                onClick={onBrowse}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
            >
                <span className="text-[28px] text-[#f2b84b]">↑</span>
                <strong className="font-dm text-[14px] tracking-[.08em]">
                    {dragging ? "DROP TO MAP" : "DROP YOUR ZIP HERE"}
                </strong>
                <span className="font-dm text-xs text-[#7e8985] light:text-[#61716a]">
                    or <u>browse files</u> · max 200 MB
                </span>
            </button>
            {error && <p className="font-dm text-xs text-[#f28b78]">{error}</p>}
            <div className="my-5 flex w-full max-w-[570px] items-center gap-4 font-dm text-[11px] tracking-[.14em] text-[#65706c]">
                <span className="h-px flex-1 bg-[#2a3330] light:bg-[#d3ddd6]" />
                <span>OR</span>
                <span className="h-px flex-1 bg-[#2a3330] light:bg-[#d3ddd6]" />
            </div>
        </section>

        <div className="flex w-full max-w-[480px] min-w-0 flex-col">
          <div className="flex w-full gap-3">
                <input
                    type="text"
                    value={githubUrl}
                    onChange={(event) => onGitHubUrlChange(event.target.value)}
                    onKeyDown={(event) => {
                        if (event.key === "Enter") onGitHubImport();
                    }}
                    placeholder="https://github.com/owner/repository"
                    className="min-w-0 flex-1 border border-[#626b66] bg-[#1a2120] px-4 py-3 font-dm text-[13px] text-[#eef0eb] outline-none transition-[border-color] duration-200 placeholder:text-[#7e8985] focus:border-[#64d5c4] light:border-[#8ba49a] light:bg-[#f6f8f5] light:text-[#202824] light:placeholder:text-[#61716a] light:focus:border-[#398f83]"
                />
                <button
                    type="button"
                    onClick={onGitHubImport}
                    disabled={!githubUrl.trim()}
                    className="border border-[#64d5c4] bg-[#14231f] px-6 py-3 font-dm text-[13px] tracking-[.08em] text-[#64d5c4] transition-[background,border-color,opacity] duration-200 hover:bg-[#1d3a33] disabled:pointer-events-none disabled:opacity-40 light:border-[#398f83] light:bg-[#e3ece7] light:text-[#398f83]"
                >
                    IMPORT
                </button>
            </div>
            <div className="mt-4 w-full max-w-[570px]">
                <GithubConnect token={githubToken} onImport={onGitHubRepoImport} />
            </div>
            <div className="mt-auto flex gap-[34px] pt-[38px] font-dm text-[11px] text-[#65706c]">
                <span>
                    <b className="mr-[7px] font-normal text-[#f2b84b]">01</b> Upload
                    archive
                </span>
                <span>
                    <b className="mr-[7px] font-normal text-[#f2b84b]">02</b> Scan
                    structure
                </span>
                <span>
                    <b className="mr-[7px] font-normal text-[#f2b84b]">03</b> Explore
                    graph
                </span>
            </div>
       </div>
       </div>
       </div>
    );
}

export default LandingView;
