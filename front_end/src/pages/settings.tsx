import { useState } from "react";
import type { FormEvent } from "react";
import BackButton from "../components/back-button";
import TopBar from "../components/workspace/topbar";
import { changePassword } from "../services/api";
import { toastDismiss, toastError, toastLoading, toastSuccess, toastValidation } from "../services/toast";

type SettingsPageProps = {
    token: string;
    user: {
        email: string;
        name: string;
        github_login?: string | null;
        avatar_url?: string | null;
        created_at?: number | null;
        password_set?: boolean;
    };
    onUserChange: (user: SettingsPageProps["user"]) => void;
    theme: "dark" | "light";
    onToggleTheme: () => void;
    onOpenProfile: () => void;
    onOpenSettings: () => void;
    onNewProject: () => void;
    onLogout: () => void;
};

function Settings({ token, user, onUserChange, theme, onToggleTheme, onOpenProfile, onOpenSettings, onNewProject, onLogout }: SettingsPageProps) {
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [changing, setChanging] = useState(false);

    const needsPassword = user.password_set === false;

    const handleChangePassword = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!needsPassword && !currentPassword) {
            toastValidation("Enter your current password.");
            return;
        }
        if (!newPassword) {
            toastValidation("Enter a new password.");
            return;
        }
        if (newPassword.length < 6) {
            toastValidation("New password must be at least 6 characters long.");
            return;
        }
        if (newPassword !== confirmPassword) {
            toastValidation("New passwords do not match.");
            return;
        }
        setChanging(true);
        const loadingId = toastLoading(needsPassword ? "Setting password…" : "Updating password…");
        try {
            await changePassword(token, needsPassword ? "" : currentPassword, newPassword);
            setCurrentPassword("");
            setNewPassword("");
            setConfirmPassword("");
            onUserChange({ ...user, password_set: true });
            toastDismiss(loadingId);
            toastSuccess(needsPassword ? "Password set. You can now sign in with email too." : "Password changed.");
        } catch (error) {
            toastDismiss(loadingId);
            const detail =
                error && typeof error === "object" && "response" in error
                    ? (error as { response?: { data?: { detail?: string } } }).response?.data?.detail
                    : undefined;
            toastError(detail ?? "Could not change password.");
        } finally {
            setChanging(false);
        }
    };

    return (
        <main className="min-h-screen bg-[var(--ca-canvas)]">
            <TopBar
                theme={theme}
                onToggleTheme={onToggleTheme}
                onOpenProfile={onOpenProfile}
                onOpenSettings={onOpenSettings}
                onNewProject={onNewProject}
                onLogout={onLogout}
                user={user}
            />
            <div className="mx-auto max-w-[760px] px-6 py-12">
                <div className="mb-6">
                    <BackButton />
                </div>
                <h1 className="mb-1 ca-display-md text-[22px] text-[var(--ca-ink)]">SETTINGS</h1>
                <p className="mb-8 text-[13px] text-[var(--ca-muted)]">Appearance and account security.</p>

                <section className="mb-8 ca-card p-6">
                    <h3 className="mb-4 ca-label !text-[12px] text-[var(--ca-ink)]">APPEARANCE</h3>
                    <div className="flex items-center justify-between gap-4">
                        <div>
                            <p className="text-[14px] font-medium text-[var(--ca-ink)]">Theme</p>
                            <p className="text-[13px] text-[var(--ca-muted)]">Currently {theme === "dark" ? "Dark" : "Light"} mode.</p>
                        </div>
                        <button
                            onClick={onToggleTheme}
                            className="ca-btn-primary !px-5"
                        >
                            {theme === "dark" ? theme === "dark" ? "Switch to Light" : "Switch to Dark" : ""}
                        </button>
                    </div>
                </section>

                <section className="ca-card p-6">
                    <h3 className="mb-1 ca-label !text-[12px] text-[var(--ca-ink)]">SECURITY</h3>
                    <p className="mb-4 text-[13px] text-[var(--ca-muted)]">
                        {needsPassword
                            ? "Your account was created with GitHub and has no password yet. Set one to also sign in with your email."
                            : "Change your account password."}
                    </p>
                    {needsPassword && (
                        <p className="mb-4 w-fit border border-[var(--ca-primary)]/50 px-2 py-1 ca-label !text-[9px] text-[var(--ca-primary)]">
                            PASSWORD NOT SET
                        </p>
                    )}
                    <form onSubmit={handleChangePassword} className="flex flex-col gap-5">
                        {!needsPassword && (
                            <label className="flex flex-col gap-2">
                                <span className="ca-label !text-[10px] text-[var(--ca-muted)]">CURRENT PASSWORD</span>
                                <input
                                    type="password"
                                    value={currentPassword}
                                    onChange={(event) => setCurrentPassword(event.target.value)}
                                    className="ca-input !h-11"
                                />
                            </label>
                        )}
                            <label className="flex flex-col gap-2">
                                <span className="ca-label !text-[10px] text-[var(--ca-muted)]">NEW PASSWORD</span>
                                <input
                                    type="password"
                                    value={newPassword}
                                    onChange={(event) => setNewPassword(event.target.value)}
                                    className="ca-input !h-11"
                                />
                            </label>
                            <label className="flex flex-col gap-2">
                                <span className="ca-label !text-[10px] text-[var(--ca-muted)]">CONFIRM NEW PASSWORD</span>
                                <input
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(event) => setConfirmPassword(event.target.value)}
                                    className="ca-input !h-11"
                                />
                            </label>
                            <div>
                                <button
                                    type="submit"
                                    disabled={changing}
                                    className="ca-btn-secondary !px-6 !text-[var(--ca-error)] !border-[var(--ca-error)] disabled:opacity-60"
                                >
                                    {changing ? "UPDATING…" : needsPassword ? "SET PASSWORD" : "UPDATE PASSWORD"}
                                </button>
                            </div>
                        </form>
                </section>
            </div>
        </main>
    );
}

export default Settings;
