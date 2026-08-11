import type { CurrentUser } from "../../services/api";
import { Sun, Moon, Settings } from "lucide-react";
import codeAtlasLogo from "../../../public/codeAtlas_logo.png";
function ProfileIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function TopBar({
  theme,
  onToggleTheme,
  onOpenProfile,
  onOpenSettings,
  onNewProject,
  onLogout,
  user,
  tabs,
}: {
  theme: "dark" | "light";
  onToggleTheme: () => void;
  onOpenProfile: () => void;
  onOpenSettings: () => void;
  onNewProject: () => void;
  onLogout: () => void;
  user?: CurrentUser | null;
  tabs?: { id: string; label: string; active: boolean; onClick: () => void }[];
}) {
  return (
    <header className="relative z-[2] flex h-[64px] items-center justify-between gap-4 border-b border-[var(--ca-hairline)] bg-[var(--ca-canvas)] px-6 max-[850px]:px-4">
      <div className="flex min-w-0 items-center gap-3">
        <div>
          {" "}
          <img src={codeAtlasLogo} className="h-12 w-12 rounded-full" />
        </div>
        <span className="hidden h-8 w-px bg-[var(--ca-hairline-strong)] sm:block" />
        <button
          onClick={onNewProject}
          className="hidden items-center rounded-[8px] border border-[var(--ca-hairline-strong)] bg-[var(--ca-surface-card)] px-3 py-[7px] text-[11px] font-medium text-[var(--ca-body)] transition-colors hover:border-[var(--ca-primary)] hover:text-[var(--ca-primary)] sm:inline-flex"
        >
          + New Project
        </button>
      </div>

      {tabs && tabs.length > 0 && (
        <nav
          className="absolute left-1/2 flex -translate-x-1/2 items-center gap-1"
          aria-label="Project sections"
        >
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={tab.onClick}
              className={`rounded-[6px] bg-transparent px-3 py-2 text-[13px] font-medium transition-colors ${
                tab.active
                  ? "text-[var(--ca-ink)] shadow-[inset_0_-2px_0_var(--ca-primary)] border-t-2"
                  : "text-[var(--ca-muted)] hover:bg-[var(--ca-surface-strong)] hover:text-[var(--ca-ink)]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      )}

      <div className="flex items-center gap-2">
        <button
          className="grid h-[38px] w-[38px] place-items-center overflow-hidden rounded-[8px] border border-[var(--ca-hairline-strong)] bg-[var(--ca-surface-card)] text-[var(--ca-body)] transition-colors hover:border-[var(--ca-primary)] hover:text-[var(--ca-primary)]"
          onClick={onOpenProfile}
          aria-label="Open profile"
          title="Profile"
        >
          {user?.avatar_url ? (
            <img
              src={user.avatar_url}
              alt=""
              className="h-full w-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <ProfileIcon />
          )}
        </button>
        <button
          className="grid h-[38px] w-[38px] place-items-center rounded-[8px] border border-[var(--ca-hairline-strong)] bg-[var(--ca-surface-card)] text-[var(--ca-body)] transition-colors hover:border-[var(--ca-primary)] hover:text-[var(--ca-primary)] max-[850px]:hidden"
          onClick={onToggleTheme}
          aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
        >
          {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
        </button>
        <button
          className="grid h-[38px] w-[38px] place-items-center rounded-[8px] border border-[var(--ca-hairline-strong)] bg-[var(--ca-surface-card)] text-[var(--ca-body)] transition-colors hover:border-[var(--ca-primary)] hover:text-[var(--ca-primary)]"
          onClick={onOpenSettings}
          aria-label="Open settings"
          title="Settings"
        >
          <Settings size={16} />
        </button>
        <button
          onClick={onLogout}
          aria-label="Sign out"
          className="inline-flex h-[40px] items-center gap-2 rounded-[8px] border border-[var(--ca-primary)] bg-[var(--ca-primary)] px-4 text-[13px] font-medium text-[var(--ca-on-primary)] transition-colors hover:bg-[var(--ca-primary-active)]"
        >
          Log out
        </button>
      </div>
    </header>
  );
}

export default TopBar;
