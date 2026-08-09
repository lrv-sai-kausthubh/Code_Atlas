import { toast } from "sonner";
import type { CSSProperties } from "react";
import { CircleAlert, CircleCheck, Info } from "lucide-react";

type StateKind =
    | "info"
    | "loading"
    | "processing"
    | "success"
    | "error"
    | "empty"
    | "forbidden"
    | "offline"
    | "notFound"
    | "unauthorized"
    | "validation";

type ToastOptions = {
    description?: string;
    duration?: number;
    action?: { label: string; onClick: () => void };
};

type KindStyle = { palette: "gray" | "red" | "green" };

const KIND_STYLE: Record<StateKind, KindStyle> = {
    info: { palette: "gray" },
    loading: { palette: "gray" },
    processing: { palette: "gray" },
    empty: { palette: "gray" },
    offline: { palette: "gray" },
    success: { palette: "green" },
    error: { palette: "red" },
    forbidden: { palette: "red" },
    notFound: { palette: "red" },
    unauthorized: { palette: "red" },
    validation: { palette: "red" },
};

const PALETTE: Record<KindStyle["palette"], CSSProperties> = {
    gray: { background: "#191d1c", border: "1px solid #6d7974" },
    red: { background: "#2a1714", border: "1px solid #f17c71" },
    green: { background: "#0f211c", border: "1px solid #64d5c4" },
};

const BASE_STYLE: CSSProperties = {
    borderRadius: 0,
    boxShadow: "0 10px 34px rgba(0,0,0,.45)",
    fontFamily: "'DM Mono', ui-monospace, monospace",
    fontSize: "11px",
    letterSpacing: ".02em",
};

const OPTIONS: Record<StateKind, { title: string; description: string; duration: number }> = {
    info: { title: "Info", description: "", duration: 3000 },
    loading: { title: "Loading…", description: "Fetching your workspace. Please wait.", duration: 2600 },
    processing: { title: "Processing…", description: "Your request is being processed in the background.", duration: 3000 },
    success: { title: "Success", description: "", duration: 3500 },
    error: { title: "Something went wrong", description: "An unexpected error occurred while processing.", duration: 5000 },
    empty: { title: "Nothing here yet", description: "This project has no files to display.", duration: 4000 },
    forbidden: { title: "Access Forbidden", description: "You do not have permission to view this resource.", duration: 4500 },
    offline: { title: "You're offline", description: "Check your connection and try again.", duration: 5000 },
    notFound: { title: "Not Found", description: "The requested resource could not be located.", duration: 4500 },
    unauthorized: { title: "Unauthorized", description: "Please sign in again to continue.", duration: 4500 },
    validation: { title: "Validation Error", description: "Some fields need your attention before continuing.", duration: 5000 },
};

export const toastState = (kind: StateKind, options?: ToastOptions) => {
    const preset = OPTIONS[kind];
    const { palette } = KIND_STYLE[kind];
    const title = options?.description || preset.title;
    const description = options?.description ? preset.description || undefined : undefined;
    const accent = palette === "red" ? "#f17c71" : palette === "green" ? "#64d5c4" : "#b9c1bd";
    return toast(title, {
        description,
        duration: options?.duration ?? preset.duration,
        action: options?.action,
        icon:
            palette === "red" ? (
                <CircleAlert size={16} style={{ color: accent }} />
            ) : palette === "green" ? (
                <CircleCheck size={16} style={{ color: accent }} />
            ) : (
                <Info size={16} style={{ color: accent }} />
            ),
        style: { ...BASE_STYLE, ...PALETTE[palette] },
        descriptionClassName: "!text-[#89958f]",
        className: "!text-[#eef0eb]",
    });
};

export const toastLoading = (description?: string) => toastState("loading", { description });
export const toastInfo = (description?: string) => toastState("info", { description });
export const toastError = (description?: string) => toastState("error", { description });
export const toastSuccess = (description?: string) => toastState("success", { description });
export const toastEmpty = (description?: string) => toastState("empty", { description });
export const toastForbidden = (description?: string) => toastState("forbidden", { description });
export const toastOffline = (description?: string) => toastState("offline", { description });
export const toastNotFound = (description?: string) => toastState("notFound", { description });
export const toastProcessing = (description?: string) => toastState("processing", { description });
export const toastUnauthorized = (description?: string) => toastState("unauthorized", { description });
export const toastValidation = (description?: string) => toastState("validation", { description });

export const toastDismiss = toast.dismiss;
