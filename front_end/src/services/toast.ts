import { toast } from "sonner";

type StateKind = "loading" | "error" | "success" | "empty" | "forbidden" | "offline" | "notFound" | "processing" | "unauthorized" | "validation";

type ToastOptions = {
    description?: string;
    duration?: number;
    action?: { label: string; onClick: () => void };
};

const OPTIONS: Record<StateKind, { title: string; description: string; duration: number }> = {
    loading: { title: "Loading…", description: "Fetching your workspace. Please wait.", duration: 2600 },
    error: { title: "Something went wrong", description: "An unexpected error occurred while processing.", duration: 5000 },
    success: { title: "Success", description: "The operation completed successfully.", duration: 3500 },
    empty: { title: "Nothing here yet", description: "This project has no files to display.", duration: 4000 },
    forbidden: { title: "Access Forbidden", description: "You do not have permission to view this resource.", duration: 4500 },
    offline: { title: "You're offline", description: "Check your connection and try again.", duration: 5000 },
    notFound: { title: "Not Found", description: "The requested resource could not be located.", duration: 4500 },
    processing: { title: "Processing…", description: "Your request is being processed in the background.", duration: 3000 },
    unauthorized: { title: "Unauthorized", description: "Please sign in again to continue.", duration: 4500 },
    validation: { title: "Validation Error", description: "Some fields need your attention before continuing.", duration: 5000 },
};

export const toastState = (kind: StateKind, options?: ToastOptions) => {
    const preset = OPTIONS[kind];
    const title = options?.action ? `${preset.title} · ${options.action.label}` : preset.title;
    return toast(title, {
        description: options?.description ?? preset.description,
        duration: options?.duration ?? preset.duration,
        action: options?.action,
    });
};

export const toastLoading = (description?: string) => toastState("loading", { description });
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
