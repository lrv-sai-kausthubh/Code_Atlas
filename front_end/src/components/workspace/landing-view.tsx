import type { DragEvent } from "react";

function LandingView({
    dragging,
    error,
    onBrowse,
    onDragOver,
    onDragLeave,
    onDrop,
}: {
    dragging: boolean;
    error: string;
    onBrowse: () => void;
    onDragOver: (event: DragEvent) => void;
    onDragLeave: () => void;
    onDrop: (event: DragEvent) => void;
}) {
    return (
        <section className="relative mx-auto max-w-[850px] px-[30px] pb-20 pt-[126px] max-[850px]:pt-[90px]">
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
            <div className="mt-[38px] flex gap-[34px] font-dm text-[11px] text-[#65706c]">
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
            <div className="pointer-events-none absolute -right-[290px] top-[50px] h-[490px] w-[490px] rounded-full border border-[#253a37] light:border-[#cbded6]" />
            <div className="pointer-events-none absolute -right-[410px] -top-[70px] h-[730px] w-[730px] rounded-full border border-[#202e2c] light:border-[#cbded6]" />
        </section>
    );
}

export default LandingView;
