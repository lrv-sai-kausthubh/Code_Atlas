import { useCallback, useEffect, useRef, useState } from "react";
import { getMe, listGitHubRepos } from "../../services/api";
import type { GitHubRepo } from "../../services/api";
import {
  toastDismiss,
  toastError,
  toastLoading,
  toastSuccess,
} from "../../services/toast";

function GithubConnect({
  token,
  onImport,
}: {
  token: string;
  onImport: (repo: GitHubRepo) => void;
}) {
  const [user, setUser] = useState<{
    email: string;
    name: string;
    github_login?: string | null;
  } | null>(null);
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const greetedRef = useRef(false);
  const inflightRef = useRef(false);

  const refresh = useCallback(async () => {
    if (inflightRef.current) return;
    inflightRef.current = true;
    setLoading(true);
    const loadingId = toastLoading("Connecting to GitHub…");
    try {
      const [meResponse, reposResponse] = await Promise.all([
        getMe(token),
        listGitHubRepos(token),
      ]);
      setUser(meResponse.data.user);
      setRepos(reposResponse.data.repos);
      if (!greetedRef.current) {
        greetedRef.current = true;
        toastSuccess("GitHub connected.");
      }
    } catch (error) {
      setUser(null);
      const detail = (error as { response?: { data?: { detail?: string } } })?.response?.data
        ?.detail;
      toastError(detail ?? "Could not reach GitHub. Reconnect to sync your repositories.");
    } finally {
      toastDismiss(loadingId);
      setLoading(false);
      inflightRef.current = false;
    }
  }, [token]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const connectUrl = `${import.meta.env.VITE_API_URL || "http://127.0.0.1:8000"}/api/auth/github/authorize`;
  const filtered = filter.trim()
    ? repos.filter((repo) =>
        repo.full_name.toLowerCase().includes(filter.trim().toLowerCase()),
      )
    : repos;

  return (
    <div className="w-full max-w-[570px]">
      {!user ? (
        <button
          type="button"
          onClick={() => {
            window.location.href = connectUrl;
          }}
          disabled={loading}
          className="flex w-full items-center justify-center gap-3 border border-[#626b66] bg-[#1a2120] px-6 py-4 font-dm text-[13px] tracking-[.08em] text-[#eef0eb] transition-[background,border-color,opacity] duration-200 hover:border-[#64d5c4] hover:bg-[#24312e] disabled:pointer-events-none disabled:opacity-50 light:border-[#8ba49a] light:bg-[#f6f8f5] light:text-[#202824] light:hover:border-[#398f83] light:hover:bg-[#e3ece7]"
        >
          <GitHubMark />
          CONNECT GITHUB ACCOUNT
        </button>
      ) : (
        <div className="border border-[#2a3330] bg-[#1a2120] light:border-[#d3ddd6] light:bg-white">
          <div className="flex items-center justify-between gap-3 border-b border-[#2a3330] px-4 py-3 light:border-[#d3ddd6]">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid h-8 w-8 shrink-0 place-items-center bg-[#64d5c4] font-dm text-[13px] font-bold text-[#0b1f1b]">
                {(user.name || user.email).slice(0, 1).toUpperCase()}
              </span>
              <div className="min-w-0">
                <div className="truncate font-dm text-[13px] text-[#eef0eb] light:text-[#202824]">
                  {user.name}
                </div>
                <div className="truncate font-dm text-[10px] text-[#7e8985] light:text-[#61716a]">
                  {user.github_login ? `@${user.github_login}` : user.email}
                </div>
              </div>
            </div>
            <a
              href={`${connectUrl}?prompt=select_account`}
              className="shrink-0 font-dm text-[10px] tracking-[.08em] text-[#64d5c4] no-underline hover:text-[#f2b84b] light:text-[#398f83]"
            >
              SWITCH
            </a>
          </div>
          <div className="border-b border-[#2a3330] p-3 light:border-[#d3ddd6]">
            <input
              type="text"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              placeholder="Filter repositories..."
              className="w-full border border-[#3a453f] bg-[#111414] px-3 py-2 font-dm text-[12px] text-[#eef0eb] outline-none focus:border-[#64d5c4] light:border-[#ccd8d1] light:bg-[#edf2ee] light:text-[#202824]"
            />
          </div>
          <ul className="max-h-[300px] overflow-y-auto no-scrollbar">
            {filtered.length === 0 ? (
              <li className="px-4 py-5 text-center font-dm text-[11px] text-[#7e8985] light:text-[#61716a]">
                {repos.length === 0
                  ? "No repositories found. Make sure your GitHub account has access to some."
                  : "No repositories match your filter."}
              </li>
            ) : (
              filtered.map((repo) => (
                <li
                  key={repo.full_name}
                  className="flex items-center gap-3 border-b border-[#222b28] px-4 py-3 last:border-b-0 light:border-[#e3ece7]"
                >
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${repo.private ? "bg-[#f2b84b]" : "bg-[#10b981]"}`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-dm text-[12px] text-[#eef0eb] light:text-[#202824]">
                      {repo.full_name}
                    </div>
                    <div className="truncate font-dm text-[10px] text-[#7e8985] light:text-[#61716a]">
                      {repo.language ?? "Unknown"}
                      {repo.private ? " · PRIVATE" : ""}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onImport(repo)}
                    className="shrink-0 border border-[#64d5c4] bg-transparent px-4 py-1.5 font-dm text-[10px] tracking-[.08em] text-[#64d5c4] transition-colors hover:bg-[rgba(100,213,196,.15)] light:border-[#398f83] light:text-[#398f83]"
                  >
                    IMPORT
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

function GitHubMark() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
    </svg>
  );
}

export default GithubConnect;
