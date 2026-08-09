import type { CurrentUser } from "../../services/api";
import { Sun, Moon, Settings } from "lucide-react";
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
}: {
  theme: "dark" | "light";
  onToggleTheme: () => void;
  onOpenProfile: () => void;
  onOpenSettings: () => void;
  onNewProject: () => void;
  onLogout: () => void;
  user?: CurrentUser | null;
}) {
  return (
    <header className="relative z-[2] flex h-[62px] items-center justify-between border-b border-[#2b3030] px-[42px] light:border-[#d6dfda] max-[850px]:px-[18px]">
      <div className="flex items-center gap-[11px] font-dm text-[14px] font-medium tracking-[.16em] light:text-[#202824]">
        <img
          src="/codeAtlas_logo.png"
          alt="CodeAtlas"
          className="h-[50px] w-[50px] rounded-full object-contain"
        />
        <span className="font-extrabold">CODEATLAS</span>
        <small className="ml-3 text-[9px] tracking-[.1em] text-[#777e7d] light:text-[#71807a] max-[850px]:hidden">
          V1 / MILESTONE 1
        </small>
      </div>
      <div className="flex items-center gap-[22px] font-dm text-[11px]">
        <button
          className="border border-[#596260] bg-transparent px-[14px] py-[10px] font-dm text-[11px] tracking-[.04em] text-[#eff0ed] transition-colors hover:border-[#f2b84b] hover:text-[#f2b84b] light:border-[#b8c8c0] light:text-[#202824]"
          onClick={onNewProject}
        >
          + NEW PROJECT
        </button>
        <button
          className="grid h-[38px] w-[38px]  rounded-lg place-items-center overflow-hidden border border-[#596260] bg-transparent text-[#aeb8b3] transition-colors hover:border-[#f2b84b] hover:text-[#f2b84b] light:border-[#b8c8c0] light:text-[#405149]"
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
          className="border border-[#596260]  rounded-full  bg-transparent p-2 font-dm text-[10px] tracking-[.05em] text-[#aeb8b3] transition-colors hover:border-[#f2b84b] hover:text-[#f2b84b] light:border-[#b8c8c0] light:text-[#405149] max-[850px]:hidden"
          onClick={onToggleTheme}
          aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
        >
          {theme === "dark" ? <Sun /> : <Moon />}
        </button>

        <button
          className="grid h-[38px]  rounded-full  w-[38px] place-items-center border border-[#596260] bg-transparent text-[#aeb8b3] transition-colors hover:border-[#f2b84b] hover:text-[#f2b84b] light:border-[#b8c8c0] light:text-[#405149]"
          onClick={onOpenSettings}
          aria-label="Open settings"
          title="Settings"
        >
          <Settings />
        </button>

        <button
          className="border border-[#596260]  bg-transparent px-[14px] py-[10px] font-dm text-[11px] tracking-[.04em] text-[#aeb8b3] transition-colors hover:border-[#f17c71] hover:text-[#f17c71] light:border-[#b8c8c0] light:text-[#405149]"
          onClick={onLogout}
          aria-label="Sign out"
        >
          LOG OUT
        </button>
      </div>
    </header>
  );
}

export default TopBar;
