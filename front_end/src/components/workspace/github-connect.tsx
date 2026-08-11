import { useCallback, useEffect, useRef, useState } from "react";
import { getMe, listGitHubRepos } from "../../services/api";
import type { GitHubRepo } from "../../services/api";
import { GitBranch } from "lucide-react";
import EmptyState from "../empty-state";
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
          className="flex w-full items-center justify-center gap-3 border border-[var(--ca-hairline-strong)] bg-[var(--ca-surface-card)] px-6 py-4 ca-mono-label !text-[13px] tracking-[.08em] text-[var(--ca-ink)] transition-[background,border-color,opacity] duration-200 hover:border-[var(--ca-primary)] hover:bg-[var(--ca-surface-strong)] disabled:pointer-events-none disabled:opacity-50    "
        >
          <GitHubMark />
          CONNECT GITHUB ACCOUNT
        </button>
      ) : (
        <div className="border border-[var(--ca-hairline)] bg-[var(--ca-surface-card)]">
          <div className="flex items-center justify-between gap-3 border-b border-[var(--ca-hairline)] px-4 py-3  ">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid h-8 w-8 shrink-0 place-items-center bg-[var(--ca-success)] ca-mono-label !text-[13px] font-bold text-[var(--ca-canvas)]">
                {(user.name || user.email).slice(0, 1).toUpperCase()}
              </span>
              <div className="min-w-0">
                <div className="truncate ca-mono-label !text-[13px] text-[var(--ca-ink)]">
                  {user.name}
                </div>
                <div className="truncate ca-mono-label !text-[10px] text-[var(--ca-muted)]">
                  {user.github_login ? `@${user.github_login}` : user.email}
                </div>
              </div>
            </div>
            <a
              href={`${connectUrl}?prompt=select_account`}
              className="shrink-0 ca-mono-label !text-[10px] tracking-[.08em] text-[var(--ca-success)] no-underline hover:text-[var(--ca-primary)] "
            >
              SWITCH
            </a>
          </div>
          <div className="border-b border-[var(--ca-hairline)] p-3  ">
            <input
              type="text"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              placeholder="Filter repositories..."
              className="w-full border border-[var(--ca-hairline)] bg-[var(--ca-canvas-soft)] px-3 py-2 ca-mono-label !text-[12px] text-[var(--ca-ink)] outline-none focus:border-[var(--ca-success)]  "
            />
          </div>
          <ul className="max-h-[300px] overflow-y-auto no-scrollbar">
            {filtered.length === 0 ? (
              <li className="list-none">
                <EmptyState
                  compact
                  icon={GitBranch}
                  title="No repositories"
                  description={
                    repos.length === 0
                      ? "Make sure your GitHub account has access to some."
                      : "No repositories match your filter."
                  }
                />
              </li>
            ) : (
              filtered.map((repo) => (
                <li
                  key={repo.full_name}
                  className="flex items-center gap-3 border-b border-[var(--ca-hairline-soft)] px-4 py-3 last:border-b-0"
                >
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${repo.private ? "bg-[var(--ca-primary)]" : "bg-[var(--ca-success)]"}`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate ca-mono-label !text-[12px] text-[var(--ca-ink)]">
                      {repo.full_name}
                    </div>
                    <div className="truncate ca-mono-label !text-[10px] text-[var(--ca-muted)]">
                      {repo.language ?? "Unknown"}
                      {repo.private ? " · PRIVATE" : ""}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onImport(repo)}
                    className="shrink-0 border border-[var(--ca-success)] bg-transparent px-4 py-1.5 ca-mono-label !text-[10px] tracking-[.08em] text-[var(--ca-success)] transition-colors hover:bg-[color-mix(in_srgb,var(--ca-success)_12%,var(--ca-surface-card))]  "
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
