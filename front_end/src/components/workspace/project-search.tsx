import { useEffect, useRef, useState } from "react";
import { searchProject } from "../../services/api";
import type {
  ProjectGraph,
  ProjectNode,
  SearchResult,
} from "../../types/project";
import { toastError } from "../../services/toast";
import { Search, Lock, X } from "lucide-react";

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
          className="flex items-center gap-1.5 border border-[var(--graph-edge)] bg-[var(--graph-surface)] px-2 py-[6px] font-dm text-[9px] tracking-[.08em] text-[var(--graph-label)] transition-colors hover:border-[#f2b84b] hover:text-[#f2b84b] light:border-[#b8c8c0] light:bg-[#f6f8f5] light:text-[#405149]"
          onClick={() => setOpen(true)}
          title="Search repository"
        >
          <Search size={13} />
          SEARCH
        </button>
      ) : (
        <div className="absolute  right-30 mt-8 top-[calc(100%+8px)] z-[20] w-[360px] max-w-[80vw] border border-[#2c3331] bg-[#111313] shadow-xl light:border-[#ccd8d1] light:bg-[#edf2ee]">
          <div className="flex items-center gap-1 border-b border-[#242a28] px-2 py-1.5 light:border-[#d6dfda]">
            <Search size={13} className="shrink-0 text-[#64d5c4]" />
            <input
              autoFocus
              className="min-w-0 flex-1 bg-transparent px-1 py-0.5 font-dm text-[11px] text-[#dfe5df] outline-none placeholder:text-[#5d6964] light:text-[#202824]"
              placeholder="Search files, folders, code…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") setOpen(false);
              }}
            />
            {busy && (
              <span className="font-dm text-[8px] text-[#f2b84b]">…</span>
            )}
            <button
              className="grid h-5 w-5 shrink-0 place-items-center border border-transparent text-[#79817e] hover:text-[#f2b84b]"
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
                className={`border px-2 py-0.5 font-dm text-[8px] tracking-[.08em] transition-colors ${
                  scope === option
                    ? "border-[#64d5c4] text-[#64d5c4]"
                    : "border-[#39413e] text-[#79817e] hover:border-[#f2b84b] hover:text-[#f2b84b] light:border-[#c2cfc7]"
                }`}
                onClick={() => setScope(option)}
              >
                {option.toUpperCase()}
              </button>
            ))}
          </div>
          <div className="no-scrollbar max-h-[320px] overflow-y-auto border-t border-[#242a28] light:border-[#d6dfda]">
            {!query.trim() && (
              <div className="px-3 py-2 font-dm text-[9px] text-[#5d6964]">
                Type to search. METADATA finds visible names/paths; SOURCE
                searches inside files you can read.
              </div>
            )}
            {query.trim() && results.length === 0 && !busy && (
              <div className="px-3 py-2 font-dm text-[9px] text-[#5d6964]">
                No matches in your visible scope.
              </div>
            )}
            {results.map((result, index) => {
              const locked = restricted(result);
              return (
                <button
                  key={`${result.path}-${index}`}
                  className="flex w-full items-center gap-2 border-b border-[#242a28] px-3 py-2 text-left transition-colors hover:bg-[#1a201e] light:border-[#d6dfda] light:hover:bg-[#e2eae4]"
                  onClick={() => choose(result)}
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-dm text-[10px] text-[#b9c1bd] light:text-[#34473f]">
                      {result.name || result.path}
                    </div>
                    <div className="truncate font-dm text-[8px] text-[#5d6964]">
                      {result.path}
                      {result.line ? ` · line ${result.line}` : ""}
                    </div>
                    {scope === "source" && result.text && (
                      <div className="truncate font-mono text-[8px] text-[#64d5c4]/80">
                        {result.text}
                      </div>
                    )}
                  </div>
                  {locked && (
                    <Lock size={12} className="shrink-0 text-[#f2b84b]" />
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
