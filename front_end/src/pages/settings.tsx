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
        <main className="min-h-screen bg-[radial-gradient(circle_at_72%_20%,#1a2424_0,transparent_32%),#101112] light:bg-[radial-gradient(circle_at_72%_20%,#dbeae5_0,transparent_34%),#e2e6e0]">
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
                <h1 className="mb-1 font-dm text-[22px] font-medium tracking-[.14em] text-[#eff0ed] light:text-[#202824]">SETTINGS</h1>
                <p className="mb-8 text-[12px] text-[#777e7d] light:text-[#71807a]">Appearance and account security.</p>

                <section className="mb-8 rounded-lg border border-[#2b3030] bg-[#15191a] p-6 light:border-[#d6dfda] light:bg-[#f6f8f5]">
                    <h3 className="mb-4 font-dm text-[13px] tracking-[.1em] text-[#aeb8b3] light:text-[#405149]">APPEARANCE</h3>
                    <div className="flex items-center justify-between gap-4">
                        <div>
                            <p className="font-dm text-[13px] text-[#eff0ed] light:text-[#202824]">Theme</p>
                            <p className="text-[12px] text-[#777e7d] light:text-[#71807a]">Currently {theme === "dark" ? "Dark" : "Light"} mode.</p>
                        </div>
                        <button
                            onClick={onToggleTheme}
                            className="border border-[#f2b84b] bg-transparent px-5 py-3 font-dm text-[11px] tracking-[.08em] text-[#f2b84b] transition-colors hover:bg-[#f2b84b] hover:text-[#101112]"
                        >
                            {theme === "dark" ? "☼ SWITCH TO LIGHT" : "◐ SWITCH TO DARK"}
                        </button>
                    </div>
                </section>

                <section className="rounded-lg border border-[#2b3030] bg-[#15191a] p-6 light:border-[#d6dfda] light:bg-[#f6f8f5]">
                    <h3 className="mb-1 font-dm text-[13px] tracking-[.1em] text-[#aeb8b3] light:text-[#405149]">SECURITY</h3>
                    <p className="mb-4 text-[12px] text-[#777e7d] light:text-[#71807a]">
                        {needsPassword
                            ? "Your account was created with GitHub and has no password yet. Set one to also sign in with your email."
                            : "Change your account password."}
                    </p>
                    {needsPassword && (
                        <p className="mb-4 w-fit border border-[#f2b84b]/60 px-2 py-1 font-dm text-[9px] tracking-[.08em] text-[#f2b84b]">
                            PASSWORD NOT SET
                        </p>
                    )}
                    <form onSubmit={handleChangePassword} className="flex flex-col gap-5">
                        {!needsPassword && (
                            <label className="flex flex-col gap-2">
                                <span className="font-dm text-[10px] tracking-[.1em] text-[#777e7d] light:text-[#71807a]">CURRENT PASSWORD</span>
                                <input
                                    type="password"
                                    value={currentPassword}
                                    onChange={(event) => setCurrentPassword(event.target.value)}
                                    className="border border-[#2b3030] bg-transparent px-4 py-3 font-dm text-[13px] text-[#eff0ed] outline-none transition-colors focus:border-[#f2b84b] light:border-[#c8d3cd] light:text-[#202824]"
                                />
                            </label>
                        )}
                            <label className="flex flex-col gap-2">
                                <span className="font-dm text-[10px] tracking-[.1em] text-[#777e7d] light:text-[#71807a]">NEW PASSWORD</span>
                                <input
                                    type="password"
                                    value={newPassword}
                                    onChange={(event) => setNewPassword(event.target.value)}
                                    className="border border-[#2b3030] bg-transparent px-4 py-3 font-dm text-[13px] text-[#eff0ed] outline-none transition-colors focus:border-[#f2b84b] light:border-[#c8d3cd] light:text-[#202824]"
                                />
                            </label>
                            <label className="flex flex-col gap-2">
                                <span className="font-dm text-[10px] tracking-[.1em] text-[#777e7d] light:text-[#71807a]">CONFIRM NEW PASSWORD</span>
                                <input
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(event) => setConfirmPassword(event.target.value)}
                                    className="border border-[#2b3030] bg-transparent px-4 py-3 font-dm text-[13px] text-[#eff0ed] outline-none transition-colors focus:border-[#f2b84b] light:border-[#c8d3cd] light:text-[#202824]"
                                />
                            </label>
                            <div>
                                <button
                                    type="submit"
                                    disabled={changing}
                                    className="border border-[#f17c71] bg-transparent px-6 py-3 font-dm text-[11px] tracking-[.08em] text-[#f17c71] transition-colors hover:bg-[#f17c71] hover:text-[#101112] disabled:opacity-60"
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
