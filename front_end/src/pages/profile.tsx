import { useState } from "react";
import type { FormEvent } from "react";
import BackButton from "../components/back-button";
import TopBar from "../components/workspace/topbar";
import { updateProfile, changePassword } from "../services/api";
import { toastDismiss, toastError, toastLoading, toastSuccess, toastValidation } from "../services/toast";

type ProfilePageProps = {
    token: string;
    user: {
        email: string;
        name: string;
        github_login?: string | null;
        avatar_url?: string | null;
        created_at?: number | null;
        password_set?: boolean;
    };
    onUserChange: (user: ProfilePageProps["user"]) => void;
    theme: "dark" | "light";
    onToggleTheme: () => void;
    onOpenProfile: () => void;
    onOpenSettings: () => void;
    onNewProject: () => void;
    onLogout: () => void;
};

function Profile({ token, user, onUserChange, theme, onToggleTheme, onOpenProfile, onOpenSettings, onNewProject, onLogout }: ProfilePageProps) {
    const [name, setName] = useState(user.name || "");
    const [avatarUrl, setAvatarUrl] = useState(user.avatar_url || "");
    const [saving, setSaving] = useState(false);
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [settingPassword, setSettingPassword] = useState(false);

    const needsPassword = user.password_set === false;

    const handleSetPassword = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (newPassword.length < 6) {
            toastValidation("Password must be at least 6 characters long.");
            return;
        }
        if (newPassword !== confirmPassword) {
            toastValidation("Passwords do not match.");
            return;
        }
        setSettingPassword(true);
        const loadingId = toastLoading("Setting password…");
        try {
            await changePassword(token, "", newPassword);
            setNewPassword("");
            setConfirmPassword("");
            onUserChange({ ...user, password_set: true });
            toastDismiss(loadingId);
            toastSuccess("Password set. You can now sign in with email too.");
        } catch (error) {
            toastDismiss(loadingId);
            const detail =
                error && typeof error === "object" && "response" in error
                    ? (error as { response?: { data?: { detail?: string } } }).response?.data?.detail
                    : undefined;
            toastError(detail ?? "Could not set password.");
        } finally {
            setSettingPassword(false);
        }
    };

    const handleSave = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const cleanName = name.trim();
        if (!cleanName) {
            toastValidation("Name cannot be empty.");
            return;
        }
        setSaving(true);
        const loadingId = toastLoading("Saving profile…");
        try {
            const response = await updateProfile(token, cleanName, avatarUrl.trim() || undefined);
            onUserChange(response.data.user);
            toastDismiss(loadingId);
            toastSuccess("Profile updated.");
        } catch (error) {
            toastDismiss(loadingId);
            const detail =
                error && typeof error === "object" && "response" in error
                    ? (error as { response?: { data?: { detail?: string } } }).response?.data?.detail
                    : undefined;
            toastError(detail ?? "Could not save profile.");
        } finally {
            setSaving(false);
        }
    };

    const joinedDate = user.created_at
        ? new Date(user.created_at * 1000).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })
        : "—";

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
            <div className="mx-auto max-w-[760px] px-6 py-5">
                <div className="mb-4">
                    <BackButton />
                </div>
                <h1 className="mb-1 ca-display-md text-[22px] text-[var(--ca-ink)]">PROFILE</h1>
                <p className="mb-8 text-[13px] text-[var(--ca-muted)]">Manage your personal information and connected accounts.</p>

                <section className="mb-8 flex items-center gap-6 ca-card p-6">
                    {user.avatar_url ? (
                        <img src={user.avatar_url} alt="avatar" className="h-20 w-20 rounded-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                        <span className="grid h-20 w-20 place-items-center rounded-full border border-[var(--ca-hairline-strong)] text-3xl text-[var(--ca-primary)]">
                            {(user.name || user.email || "?").charAt(0).toUpperCase()}
                        </span>
                    )}
                    <div className="min-w-0">
                        <h2 className="truncate text-[18px] font-medium text-[var(--ca-ink)]">{user.name || "Unnamed user"}</h2>
                        <p className="truncate text-[13px] text-[var(--ca-body)]">{user.email}</p>
                        {user.github_login && (
                            <span className="mt-2 inline-block rounded-full border border-[var(--ca-success)] bg-[color-mix(in_srgb,var(--ca-success)_10%,var(--ca-surface-card))] px-3 py-1 ca-mono-label !text-[10px] text-[var(--ca-success)]">
                                GITHUB · @{user.github_login}
                            </span>
                        )}
                    </div>
                </section>

                {needsPassword && (
                    <section className="mb-8 rounded-lg border border-[var(--ca-primary)]/40 bg-[var(--ca-surface-card)] p-6">
                        <h3 className="mb-1 ca-label !text-[12px] text-[var(--ca-primary)]">SET ACCOUNT PASSWORD</h3>
                        <p className="mb-4 text-[13px] text-[var(--ca-muted)]">
                            You signed in with GitHub, so your account has no password yet. Set one so you can
                            also sign in with your email.
                        </p>
                        <form onSubmit={handleSetPassword} className="flex flex-col gap-5">
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
                                <span className="ca-label !text-[10px] text-[var(--ca-muted)]">CONFIRM PASSWORD</span>
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
                                    disabled={settingPassword}
                                    className="ca-btn-primary !px-6 disabled:opacity-60"
                                >
                                    {settingPassword ? "SETTING…" : "SET PASSWORD"}
                                </button>
                            </div>
                        </form>
                    </section>
                )}

                <section className="ca-card p-6">
                    <h3 className="mb-4 ca-label !text-[12px] text-[var(--ca-ink)]">EDIT PROFILE</h3>
                    <form onSubmit={handleSave} className="flex flex-col gap-5">
                        <label className="flex flex-col gap-2">
                            <span className="ca-label !text-[10px] text-[var(--ca-muted)]">DISPLAY NAME</span>
                            <input
                                value={name}
                                onChange={(event) => setName(event.target.value)}
                                placeholder="Your name"
                                className="ca-input !h-11"
                            />
                        </label>
                        <label className="flex flex-col gap-2">
                            <span className="ca-label !text-[10px] text-[var(--ca-muted)]">AVATAR URL</span>
                            <input
                                value={avatarUrl}
                                onChange={(event) => setAvatarUrl(event.target.value)}
                                placeholder="https://…"
                                className="ca-input !h-11"
                            />
                        </label>
                        <div className="flex items-center gap-4">
                            <button
                                type="submit"
                                disabled={saving}
                                className="ca-btn-primary !px-6 disabled:opacity-60"
                            >
                                {saving ? "SAVING…" : "SAVE CHANGES"}
                            </button>
                            <span className="ca-mono-label !text-[10px] text-[var(--ca-muted)]">
                                MEMBER SINCE {joinedDate}
                            </span>
                        </div>
                    </form>
                </section>
            </div>
        </main>
    );
}

export default Profile;
