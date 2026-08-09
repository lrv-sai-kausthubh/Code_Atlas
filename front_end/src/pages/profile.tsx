import { useState } from "react";
import type { FormEvent } from "react";
import BackButton from "../components/back-button";
import TopBar from "../components/workspace/topbar";
import { updateProfile } from "../services/api";
import { toastDismiss, toastError, toastLoading, toastSuccess, toastValidation } from "../services/toast";

type ProfilePageProps = {
    token: string;
    user: {
        email: string;
        name: string;
        github_login?: string | null;
        avatar_url?: string | null;
        created_at?: number | null;
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
            <div className="mx-auto max-w-[760px] px-6 py-5">
                <div className="mb-4">
                    <BackButton />
                </div>
                <h1 className="mb-1 font-dm text-[22px] font-medium tracking-[.14em] text-[#eff0ed] light:text-[#202824]">PROFILE</h1>
                <p className="mb-8 text-[12px] text-[#777e7d] light:text-[#71807a]">Manage your personal information and connected accounts.</p>

                <section className="mb-8 flex items-center gap-6 rounded-lg border border-[#2b3030] bg-[#15191a] p-6 light:border-[#d6dfda] light:bg-[#f6f8f5]">
                    {user.avatar_url ? (
                        <img src={user.avatar_url} alt="avatar" className="h-20 w-20 rounded-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                        <span className="grid h-20 w-20 place-items-center rounded-full border border-[#596260] text-3xl text-[#f2b84b] light:border-[#b8c8c0]">
                            {(user.name || user.email || "?").charAt(0).toUpperCase()}
                        </span>
                    )}
                    <div className="min-w-0">
                        <h2 className="truncate font-dm text-[18px] text-[#eff0ed] light:text-[#202824]">{user.name || "Unnamed user"}</h2>
                        <p className="truncate text-[13px] text-[#aeb8b3] light:text-[#405149]">{user.email}</p>
                        {user.github_login && (
                            <span className="mt-2 inline-block rounded-full border border-[#64d5c4] bg-[#64d5c41f] px-3 py-1 font-dm text-[10px] tracking-[.08em] text-[#64d5c4]">
                                GITHUB · @{user.github_login}
                            </span>
                        )}
                    </div>
                </section>

                <section className="rounded-lg border border-[#2b3030] bg-[#15191a] p-6 light:border-[#d6dfda] light:bg-[#f6f8f5]">
                    <h3 className="mb-4 font-dm text-[13px] tracking-[.1em] text-[#aeb8b3] light:text-[#405149]">EDIT PROFILE</h3>
                    <form onSubmit={handleSave} className="flex flex-col gap-5">
                        <label className="flex flex-col gap-2">
                            <span className="font-dm text-[10px] tracking-[.1em] text-[#777e7d] light:text-[#71807a]">DISPLAY NAME</span>
                            <input
                                value={name}
                                onChange={(event) => setName(event.target.value)}
                                placeholder="Your name"
                                className="border border-[#2b3030] bg-transparent px-4 py-3 font-dm text-[13px] text-[#eff0ed] outline-none transition-colors focus:border-[#f2b84b] light:border-[#c8d3cd] light:text-[#202824]"
                            />
                        </label>
                        <label className="flex flex-col gap-2">
                            <span className="font-dm text-[10px] tracking-[.1em] text-[#777e7d] light:text-[#71807a]">AVATAR URL</span>
                            <input
                                value={avatarUrl}
                                onChange={(event) => setAvatarUrl(event.target.value)}
                                placeholder="https://…"
                                className="border border-[#2b3030] bg-transparent px-4 py-3 font-dm text-[13px] text-[#eff0ed] outline-none transition-colors focus:border-[#f2b84b] light:border-[#c8d3cd] light:text-[#202824]"
                            />
                        </label>
                        <div className="flex items-center gap-4">
                            <button
                                type="submit"
                                disabled={saving}
                                className="border border-[#f2b84b] bg-transparent px-6 py-3 font-dm text-[11px] tracking-[.08em] text-[#f2b84b] transition-colors hover:bg-[#f2b84b] hover:text-[#101112] disabled:opacity-60"
                            >
                                {saving ? "SAVING…" : "SAVE CHANGES"}
                            </button>
                            <span className="font-dm text-[10px] tracking-[.08em] text-[#777e7d] light:text-[#71807a]">
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
