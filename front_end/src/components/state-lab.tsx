import { useState } from "react";
import { toastLoading, toastError, toastSuccess, toastEmpty, toastForbidden, toastOffline, toastNotFound, toastProcessing, toastUnauthorized, toastValidation, toastDismiss } from "../services/toast";

type LabState = {
    key: string;
    label: string;
    kind: string;
    available: boolean;
};

const DOT_COLORS: Record<string, string> = {
    loading: "bg-[#64d5c4]",
    error: "bg-[#f17c71]",
    success: "bg-[#10b981]",
    empty: "bg-[#c1c6d7]",
    forbidden: "bg-[#ef6719]",
    offline: "bg-[#8b5cf6]",
    notFound: "bg-[#f2b84b]",
    processing: "bg-[#007aff]",
    unauthorized: "bg-[#f472b6]",
    validation: "bg-[#eab308]",
};

const STATES: LabState[] = [
    { key: "loading", label: "Loading", kind: "loading", available: true },
    { key: "error", label: "Error", kind: "error", available: true },
    { key: "success", label: "Success", kind: "success", available: true },
    { key: "empty", label: "Empty State", kind: "empty", available: true },
    { key: "forbidden", label: "Forbidden", kind: "forbidden", available: true },
    { key: "offline", label: "Offline", kind: "offline", available: true },
    { key: "notFound", label: "Not Found", kind: "notFound", available: true },
    { key: "processing", label: "Processing", kind: "processing", available: true },
    { key: "unauthorized", label: "Unauthorized", kind: "unauthorized", available: false },
    { key: "validation", label: "Validation Error", kind: "validation", available: false },
];

const TRIGGER: Record<string, (description?: string) => string | number> = {
    loading: toastLoading,
    error: toastError,
    success: toastSuccess,
    empty: toastEmpty,
    forbidden: toastForbidden,
    offline: toastOffline,
    notFound: toastNotFound,
    processing: toastProcessing,
    unauthorized: toastUnauthorized,
    validation: toastValidation,
};

type StateLabProps = {
    onClose: () => void;
};

export default function StateLab({ onClose }: StateLabProps) {
    const [last, setLast] = useState<string | null>(null);

    const fire = (state: LabState) => {
        toastDismiss(last ?? undefined);
        let id: string | number;
        if (!state.available) {
            id = toastValidation(`"${state.label}" is coming soon.`);
        } else {
            id = TRIGGER[state.kind](`State "${state.label}" triggered from the State Lab.`);
        }
        setLast(String(id));
    };

    return (
        <div className="fixed z-40 right-6 top-[84px] w-[340px] bg-[#171a1a] border border-[#2b3030] shadow-[0_24px_60px_rgba(0,0,0,.45)] light:bg-[#f6f8f5] light:border-[#d6dfda]">
            <div className="h-[42px] flex items-center gap-2 px-[14px] border-b border-[#2b3030] text-[#b1bab5] font-dm text-[10px] tracking-[.1em] light:border-[#d6dfda] light:text-[#71807a]">
                <span className="live-dot mr-1" /> STATE LAB
                <button className="ml-auto panel-collapse" onClick={onClose} aria-label="Close state lab"><span className="material-symbols-outlined">close</span></button>
            </div>
            <div className="grid grid-cols-2 gap-2 p-[14px]">
                {STATES.map((state) => (
                    <button
                        key={state.key}
                        className={`flex flex-col items-start gap-1.5 p-3 border border-[#2f3a37] bg-[#10141a] text-[#c1c6d7] font-dm text-[11px] text-left cursor-pointer transition-[border-color,background] duration-150 hover:border-[#f2b84b] hover:bg-[#1a201e] light:bg-white light:border-[#ccd8d1] light:text-[#405149] light:hover:border-[#398f83] light:hover:bg-[#e3ece7] ${state.available ? "" : "opacity-45 cursor-not-allowed"}`}
                        onClick={() => fire(state)}
                    >
                        <span className={`w-2 h-2 rounded-full ${DOT_COLORS[state.kind]}`} />
                        <span>{state.label}</span>
                        {!state.available && <small className="text-[#f2b84b] text-[8px] tracking-[.1em]">SOON</small>}
                    </button>
                ))}
            </div>
        </div>
    );
}
