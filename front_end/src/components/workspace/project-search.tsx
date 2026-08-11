import { useEffect, useRef, useState } from "react";
import { searchProject } from "../../services/api";
import type {
  ProjectGraph,
  ProjectNode,
  SearchResult,
} from "../../types/project";
import { toastError } from "../../services/toast";
import { Search, Lock, X, SearchX } from "lucide-react";
import EmptyState from "../empty-state";

function ProjectSearch({
  graph,
  projectId,
  token,
  onSelect,
}: {
  graph: ProjectGraph;
  projectId: string;
  token: string;
  onSelect: (node: ProjectNode) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<"metadata" | "source">("metadata");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [busy, setBusy] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setBusy(true);
      try {
        const response = await searchProject(projectId, trimmed, scope, token);
        setResults(response.data.results);
      } catch {
        setResults([]);
      } finally {
        setBusy(false);
      }
    }, 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, scope, projectId, token]);

  useEffect(() => {
    const onDown = (event: PointerEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, []);

  const nodeByPath = (path: string) =>
    graph.nodes.find((node) => node.path === path) ?? null;

  const choose = (result: SearchResult) => {
    const node = nodeByPath(result.path);
    if (node) {
      onSelect(node);
    } else {
      toastError("This file is not available in the current view.");
    }
  };

  const restricted = (result: SearchResult) =>
    result.access && !result.access.source;

  return (
    <div className="relative" ref={panelRef}>
      {!open ? (
        <button
          className="flex h-full items-center gap-1.5 px-[11px] text-[var(--graph-label)] transition-colors hover:bg-[var(--ca-surface-strong)] hover:text-[var(--ca-primary)]"
          onClick={() => setOpen(true)}
          title="Search repository"
        >
          <Search size={13} />
          <span className="ca-mono-label !text-[9px] max-[1150px]:hidden">SEARCH</span>
        </button>
      ) : (
        <div className="absolute right-0 top-[calc(100%+6px)] z-[20] w-[360px] max-w-[80vw] border border-[var(--ca-hairline)] bg-[var(--ca-surface-card)] shadow-[0_18px_40px_rgba(0,0,0,.35)]">
          <div className="flex items-center gap-1 border-b border-[var(--ca-hairline)] px-2 py-1.5 ">
            <Search size={13} className="shrink-0 text-[var(--ca-success)]" />
            <input
              autoFocus
              className="min-w-0 flex-1 bg-transparent px-1 py-0.5 ca-mono-label !text-[11px] outline-none placeholder:text-[var(--ca-muted-soft)] "
              placeholder="Search files, folders, code…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") setOpen(false);
              }}
            />
            {busy && (
              <span className="ca-mono-label !text-[8px] text-[var(--ca-primary)]">…</span>
            )}
            <button
              className="grid h-5 w-5 shrink-0 place-items-center border border-transparent text-[var(--ca-muted)] hover:text-[var(--ca-primary)]"
              onClick={() => setOpen(false)}
              title="Close search"
            >
              <X size={12} />
            </button>
          </div>
          <div className="flex gap-1 px-2 py-1.5">
            {(["metadata", "source"] as const).map((option) => (
              <button
                key={option}
                className={`border px-2 py-0.5 ca-mono-label !text-[8px] tracking-[.08em] transition-colors ${
                  scope === option
                    ? "border-[var(--ca-success)] text-[var(--ca-success)]"
                    : "border-[var(--ca-hairline)] text-[var(--ca-muted)] hover:border-[var(--ca-primary)] hover:text-[var(--ca-primary)] "
                }`}
                onClick={() => setScope(option)}
              >
                {option.toUpperCase()}
              </button>
            ))}
          </div>
          <div className="no-scrollbar max-h-[320px] overflow-y-auto border-t border-[var(--ca-hairline)]">
            {!query.trim() && (
              <div className="px-3 py-2 ca-mono-label !text-[9px] text-[var(--ca-muted)]">
                Type to search. METADATA finds visible names/paths; SOURCE
                searches inside files you can read.
              </div>
            )}
            {query.trim() && results.length === 0 && !busy && (
              <EmptyState
                compact
                icon={SearchX}
                title="No matches"
                description="Nothing matched in your visible scope."
              />
            )}
            {results.map((result, index) => {
              const locked = restricted(result);
              return (
                <button
                  key={`${result.path}-${index}`}
                  className="flex w-full items-center gap-2 border-b border-[var(--ca-hairline)] px-3 py-2 text-left transition-colors hover:bg-[var(--ca-surface-strong)] "
                  onClick={() => choose(result)}
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate ca-mono-label !text-[10px] text-[var(--ca-ink)]">
                      {result.name || result.path}
                    </div>
                    <div className="truncate ca-mono-label !text-[8px] text-[var(--ca-muted)]">
                      {result.path}
                      {result.line ? ` · line ${result.line}` : ""}
                    </div>
                    {scope === "source" && result.text && (
                      <div className="truncate font-mono text-[8px] text-[var(--ca-success)]/80">
                        {result.text}
                      </div>
                    )}
                  </div>
                  {locked && (
                    <Lock size={12} className="shrink-0 text-[var(--ca-primary)]" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default ProjectSearch;
