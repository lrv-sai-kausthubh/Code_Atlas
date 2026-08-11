import { useEffect, useState, useMemo } from "react";
import { Check, ChevronLeft, ChevronRight, Copy, Eye, Folder, GitFork, Lock } from "lucide-react";
import { fileIcon, formatBytes, isPreviewable } from "../atlas/file-utils";
import { NODE_COLORS } from "../atlas/atlas-types";
import { createAccessRequest, getFileContent } from "../../services/api";
import { toastSuccess, toastError } from "../../services/toast";
import {
  PANEL,
  PANEL_HEADING,
  PANEL_HEADING_ACTIONS,
  PANEL_COLLAPSE,
  MUTED,
} from "./panel-classes";
import type {
  ProjectGraph,
  ProjectNode,
  SourceFunction,
} from "../../types/project";

function RestrictedPanel({
  graph,
  selected,
  token,
}: {
  graph: ProjectGraph;
  selected: ProjectNode;
  token: string;
}) {
  const [reason, setReason] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const requestAccess = async () => {
    if (!graph.project_id) return;
    setSending(true);
    try {
      await createAccessRequest(graph.project_id, token, selected.path, reason.trim() || "Need access to inspect this module.");
      setSent(true);
      toastSuccess("Access request sent to the repository owner.");
    } catch {
      toastError("Could not send the access request.");
    } finally {
      setSending(false);
    }
  };

  const importedBy = (graph.function_calls ?? []).filter(
    (call) => call.callee_file === selected.path,
  ).length;
  const importsCount = (graph.file_details?.[selected.id]?.imports ?? []).length;

  return (
    <div className="mt-5 border border-dashed border-[var(--ca-hairline-strong)] bg-[var(--ca-canvas-soft)] p-[14px]  ">
      <div className="flex items-center gap-2 font-dm text-[10px] tracking-[.1em] text-[var(--ca-primary)]">
        <Lock size={16} />
        ACCESS RESTRICTED
      </div>
      <p className="mt-2 font-dm text-[10px] leading-[1.6] text-[var(--ca-body)] ">
        You can see this module because it participates in the architecture
        graph, but you do not have permission to view its source code. Its
        relationships remain visible under your current role.
      </p>
      <div className="mt-3 flex flex-col gap-1 border-t border-[var(--ca-hairline)] pt-3 ">
        <span className="font-dm text-[9px] text-[var(--ca-muted)]">REQUESTED PERMISSION</span>
        <strong className="font-dm text-[11px] text-[var(--ca-ink)] ">
          Source Code Access
        </strong>
      </div>
      {importsCount > 0 && (
        <div className="mt-1 flex flex-col gap-1 border-t border-[var(--ca-hairline)] pt-3 ">
          <span className="font-dm text-[9px] text-[var(--ca-muted)]">RELATIONSHIPS</span>
          <strong className="font-dm text-[11px] text-[var(--ca-ink)] ">
            {importsCount} import{importsCount === 1 ? "" : "s"} · imported by {importedBy}
          </strong>
        </div>
      )}
      {!sent ? (
        <>
          <textarea
            className="mt-3 w-full resize-none border border-[var(--ca-hairline)] bg-[var(--ca-canvas-soft)] px-[10px] py-[9px] font-dm text-[10px] leading-[1.5] text-[var(--ca-ink)] outline-none focus:border-[var(--ca-success)]   "
            placeholder="Why do you need access? (optional)"
            rows={2}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
          <button
            className="mt-[10px] flex w-full items-center justify-center gap-2 border border-[var(--graph-edge)] bg-[var(--graph-surface)] px-[10px] py-2 font-dm text-[9px] tracking-[.08em] text-[var(--graph-label)] transition-colors hover:border-[var(--ca-primary)] hover:text-[var(--ca-primary)] "
            onClick={requestAccess}
            disabled={sending}
          >
            {sending ? "SENDING…" : "REQUEST ACCESS"}
          </button>
        </>
      ) : (
        <div className="mt-3 font-dm text-[10px] text-[var(--ca-success)]">
          Request sent. The repository owner will review it.
        </div>
      )}
    </div>
  );
}

function FunctionCard({ functionDetail }: { functionDetail: SourceFunction }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-t border-[var(--ca-hairline)]">
      <button
        className="flex w-full items-center justify-between gap-2 border-0 bg-transparent py-2 text-left font-dm text-[10px] text-[var(--ca-ink)] "
        onClick={() => setOpen((value) => !value)}
      >
        <span className="min-w-0 truncate">
          {open ? "▾" : "▸"} {functionDetail.name}()
        </span>
        <span className="shrink-0 text-[8px] text-[var(--ca-muted)]">
          L{functionDetail.line_start}
        </span>
      </button>
      {open && (
        <div className="pb-3">
          <p className="mb-2 mt-0 text-[10px] leading-[1.5] text-[var(--ca-body)] ">
            {functionDetail.summary}
          </p>
          <div className="mb-2 flex flex-wrap gap-1">
            {functionDetail.inputs.length ? (
              functionDetail.inputs.map((input) => (
                <span
                  key={input.name}
                  className="border border-[var(--ca-hairline)] px-1.5 py-1 font-dm text-[8px] text-[var(--ca-success)] "
                >
                  {input.name}: {input.type}
                </span>
              ))
            ) : (
              <span className="font-dm text-[8px] text-[var(--ca-muted)]">
                No declared inputs
              </span>
            )}
          </div>
          {functionDetail.calls.length > 0 && (
            <div className="mb-2">
              <span className="font-dm text-[8px] tracking-[.08em] text-[var(--ca-muted)]">
                CALLS
              </span>
              {functionDetail.calls.map((call) => (
                <div
                  key={`${functionDetail.name}-${call.name}-${call.target}`}
                  className="mt-1 truncate font-dm text-[9px] text-[var(--ca-ink)] "
                >
                  → {call.name}
                  {call.target ? ` · ${call.target}` : ""}
                </div>
              ))}
            </div>
          )}
          {functionDetail.api_calls.length > 0 && (
            <div className="mb-2">
              <span className="font-dm text-[8px] tracking-[.08em] text-[var(--ca-muted)]">
                API / THIRD-PARTY
              </span>
              {functionDetail.api_calls.map((call) => (
                <div
                  key={`${functionDetail.name}-${call.provider}-${call.operation}`}
                  className="mt-1 truncate font-dm text-[9px] text-[var(--ca-primary)]"
                >
                  {call.provider} · {call.operation}
                </div>
              ))}
            </div>
          )}
          <pre className="max-h-[220px] overflow-auto border border-[var(--ca-hairline)] bg-[var(--ca-canvas-soft)] p-2 font-dm text-[9px] leading-[1.5] text-[var(--ca-ink)]   ">
            {functionDetail.snippet}
          </pre>
        </div>
      )}
    </div>
  );
}

function SourceCodeCard({
  selected,
  projectId,
  token,
}: {
  selected: ProjectNode;
  projectId: string;
  token: string;
}) {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let alive = true;
    setContent(null);
    setLoading(true);
    setCopied(false);
    getFileContent(projectId, selected.path, token)
      .then((response) => {
        if (alive) setContent(response.data.content);
      })
      .catch(() => {
        if (alive) setContent(null);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [projectId, selected.path, token]);

  const copy = async () => {
    if (!content) return;
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // clipboard unavailable
    }
  };

  if (loading)
    return (
      <section className="mt-5 border-t border-[var(--ca-hairline)] pt-4">
        <div className="ca-mono-label text-[9px] text-[var(--ca-muted)]">
          LOADING SOURCE…
        </div>
      </section>
    );
  if (!content) return null;
  return (
    <section className="mt-5 overflow-hidden rounded-xl border border-[var(--ca-hairline)]">
      <div className="flex items-center gap-2 border-b border-[var(--ca-hairline)] bg-[var(--ca-canvas-soft)] px-3 py-2">
        <span className="flex gap-1.5">
          <i className="h-2.5 w-2.5 rounded-full bg-[var(--ca-error)]/70" />
          <i className="h-2.5 w-2.5 rounded-full bg-[#c08532]/70" />
          <i className="h-2.5 w-2.5 rounded-full bg-[var(--ca-success)]/70" />
        </span>
        <span className="min-w-0 flex-1 truncate font-mono text-[10px] text-[var(--ca-muted)]">
          {selected.path}
        </span>
        <button
          className="ca-mono-label flex shrink-0 items-center gap-1.5 rounded-md border border-[var(--ca-hairline)] bg-[var(--ca-surface-card)] px-2 py-1 text-[9px] text-[var(--ca-body)] transition-colors hover:border-[var(--ca-primary)] hover:text-[var(--ca-primary)]"
          onClick={() => void copy()}
        >
          {copied ? <Check size={11} /> : <Copy size={11} />}
          {copied ? "COPIED" : "COPY"}
        </button>
      </div>
      <pre className="no-scrollbar m-0 max-h-[300px] overflow-auto bg-[var(--ca-canvas-soft)] p-3 font-mono text-[10.5px] leading-[1.6] text-[var(--ca-body)]">
        {content}
      </pre>
    </section>
  );
}

function InspectorPanel({
  graph,
  selected,
  projectId,
  token,
  inspectorCollapsed,
  onToggleCollapse,
  onOpenPreview,
  onSelect,
}: {
  graph: ProjectGraph;
  selected: ProjectNode | null;
  projectId: string;
  token: string;
  inspectorCollapsed: boolean;
  onToggleCollapse: () => void;
  onOpenPreview: (node: ProjectNode) => void;
  onSelect: (node: ProjectNode) => void;
}) {
  const restricted =
    selected?.type === "file" && selected.access?.source === false;
  const pathChain = useMemo(() => {
    if (!selected) return [];
    const parentById = new Map<string, ProjectNode>();
    graph.edges
      .filter((edge) => edge.relation !== "IMPORTS")
      .forEach((edge) => {
        const child = graph.nodes.find((node) => node.id === edge.target);
        const parent = graph.nodes.find((node) => node.id === edge.source);
        if (child && parent) parentById.set(child.id, parent);
      });
    const chain: ProjectNode[] = [];
    let current: ProjectNode | undefined = selected;
    while (current) {
      chain.unshift(current);
      current = parentById.get(current.id);
    }
    return chain;
  }, [graph, selected]);
  return (
    <aside
      className={`${PANEL} relative overflow-y-auto no-scrollbar px-4 py-5 col-start-5 row-start-1 max-[850px]:order-3 max-[850px]:min-h-[300px]`}
    >
      <div className={PANEL_HEADING}>
        <span>INSPECTOR</span>
        <div className={PANEL_HEADING_ACTIONS}>
          <span className={MUTED}>
            {selected ? selected.type.toUpperCase() : "NONE"}
          </span>
          <button
            className={PANEL_COLLAPSE}
            onClick={onToggleCollapse}
            aria-label={
              inspectorCollapsed ? "Expand inspector" : "Collapse inspector"
            }
          >
            {inspectorCollapsed ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
          </button>
        </div>
      </div>
      {!inspectorCollapsed && (
        <>
          {selected ? (
            <>
              <div
                className="mx-[-16px] grid grid-cols-3 gap-2 border-y border-[var(--ca-hairline)]"
                style={{ marginTop: 23, marginBottom: 25 }}
              >
                <div className="flex flex-col items-center gap-[6px] border-r border-[var(--ca-hairline)] px-2 py-3 text-center ">
                  <strong className="block font-dm text-[17px] leading-none text-[var(--ca-ink)] ">{graph.files}</strong>
                  <span className="block font-dm text-[8px] tracking-[.14em] text-[var(--ca-muted)] ">FILES</span>
                </div>
                <div className="flex flex-col items-center gap-[6px] border-r border-[var(--ca-hairline)] px-2 py-3 text-center ">
                  <strong className="block font-dm text-[17px] leading-none text-[var(--ca-ink)] ">{graph.folders}</strong>
                  <span className="block font-dm text-[8px] tracking-[.14em] text-[var(--ca-muted)] ">FOLDERS</span>
                </div>
                <div className="flex flex-col items-center gap-[6px] px-2 py-3 text-center">
                  <strong className="block font-dm text-[17px] leading-none text-[var(--ca-ink)] ">{Object.keys(graph.languages).length}</strong>
                  <span className="block font-dm text-[8px] tracking-[.14em] text-[var(--ca-muted)] ">LANGUAGES</span>
                </div>
              </div>
              <div
                className="mt-3 text-[45px]"
                style={{ color: NODE_COLORS[selected.type] }}
              >
                {selected.type === "file" ? (
                  <FileTypeIcon label={selected.label} />
                ) : selected.type === "folder" ? (
                  <Folder size={45} strokeWidth={1.2} />
                ) : (
                  <GitFork size={45} strokeWidth={1.2} />
                )}
              </div>
              <nav
                className="mt-3 flex flex-wrap items-center gap-1 font-dm text-[9px] text-[var(--ca-muted)]"
                aria-label="Breadcrumb"
              >
                <span className="text-[var(--ca-primary)]">{graph.project}</span>
                {pathChain.map((node) => (
                  <span key={node.id} className="flex items-center gap-1">
                    <ChevronRight size={10} className="text-[var(--ca-muted-soft)]" />
                    <button
                      className={`border-0 bg-transparent p-0 font-dm text-[9px] transition-colors ${
                        node.id === selected.id
                          ? "text-[var(--ca-ink)]"
                          : "text-[var(--ca-muted)] hover:text-[var(--ca-primary)]"
                      }`}
                      onClick={() => onSelect(node)}
                    >
                      {node.label}
                    </button>
                  </span>
                ))}
              </nav>              <h2 className="my-[5px] text-[20px] [overflow-wrap:anywhere]">
                {selected.label}
              </h2>
              <p className="font-dm text-[11px] leading-[1.5] text-[var(--ca-muted)] [overflow-wrap:anywhere] ">
                {selected.path || "/"}
              </p>
              <div className="flex flex-col gap-1.5 border-t border-[var(--ca-hairline)] py-[13px] ">
                <span className="font-dm text-[9px] text-[var(--ca-muted)]">
                  NODE TYPE
                </span>
                <strong className="font-dm text-[11px] text-[var(--ca-ink)]">
                  {selected.type}
                </strong>
              </div>
              {selected.language && (
                <div className="flex flex-col gap-1.5 border-t border-[var(--ca-hairline)] py-[13px] ">
                  <span className="font-dm text-[9px] text-[var(--ca-muted)]">
                    LANGUAGE
                  </span>
                  <strong className="font-dm text-[11px] text-[var(--ca-ink)]">
                    {selected.language}
                  </strong>
                </div>
              )}
              {selected.type === "file" && (
                <>
                  <div className="flex flex-col gap-1.5 border-t border-[var(--ca-hairline)] py-[13px] ">
                    <span className="font-dm text-[9px] text-[var(--ca-muted)]">
                      LINES
                    </span>
                    <strong className="font-dm text-[11px] text-[var(--ca-ink)]">
                      {selected.lines?.toLocaleString() ?? "-"}
                    </strong>
                  </div>
                  <div className="flex flex-col gap-1.5 border-t border-[var(--ca-hairline)] py-[13px] ">
                    <span className="font-dm text-[9px] text-[var(--ca-muted)]">
                      SIZE
                    </span>
                    <strong className="font-dm text-[11px] text-[var(--ca-ink)]">
                      {selected.size_bytes === undefined
                        ? "-"
                        : formatBytes(selected.size_bytes)}
                    </strong>
                  </div>
                </>
              )}
              <div className="flex flex-col gap-1.5 border-t border-[var(--ca-hairline)] py-[13px] ">
                <span className="font-dm text-[9px] text-[var(--ca-muted)]">
                  RELATIONSHIP
                </span>
                <strong className="font-dm text-[11px] text-[var(--ca-ink)]">
                  CONTAINS / IMPORTS
                </strong>
              </div>
              {projectId && !restricted && isPreviewable(selected) && (
                <button
                  className="mt-[14px] flex w-full items-center justify-center gap-2 border border-[var(--graph-edge)] bg-[var(--graph-surface)] px-[10px] py-2 font-dm text-[9px] tracking-[.08em] text-[var(--graph-label)] transition-colors hover:border-[var(--ca-primary)] hover:text-[var(--ca-primary)] "
                  onClick={() => onOpenPreview(selected)}
                >
                  <Eye size={16} />
                  OPEN PREVIEW
                </button>
              )}
              {selected.type === "file" &&
                (restricted ? (
                  <RestrictedPanel
                    graph={graph}
                    selected={selected}
                    token={token}
                  />
                ) : (
                  <>
                    <SourceIntelligence graph={graph} selected={selected} />
                    <SourceCodeCard
                      selected={selected}
                      projectId={projectId}
                      token={token}
                    />
                  </>
                ))}
            </>
          ) : (
            <p className="mt-[50px] font-dm text-xs leading-[1.6] text-[var(--ca-muted)] ">
              Select a node in the map to see its details.
            </p>
          )}
        </>
      )}
    </aside>
  );
}

function SourceIntelligence({
  graph,
  selected,
}: {
  graph: ProjectGraph;
  selected: ProjectNode;
}) {
  const details = graph.file_details?.[selected.id];
  const crossFileCalls = (graph.function_calls ?? []).filter(
    (call) => call.caller_file === selected.path,
  );
  if (!details && crossFileCalls.length === 0 && !selected.ml_role && !selected.ml_risk) return null;
  return (
    <section className="mt-5 border-t border-[var(--ca-hairline)] pt-4 ">
      <div className="mb-3 font-dm text-[9px] tracking-[.1em] text-[var(--ca-success)]">
        SOURCE INTELLIGENCE
      </div>
      {(selected.ml_role || selected.ml_risk) && (
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          {selected.ml_role && (
            <span
              className={`border px-1.5 py-1 font-dm text-[8px] ${
                selected.ml_role === "core"
                  ? "border-[var(--node-file)] text-[var(--node-file)]"
                  : selected.ml_role === "glue"
                    ? "border-[var(--ca-primary)] text-[var(--ca-primary)]"
                    : selected.ml_role === "data"
                      ? "border-[var(--node-file)] text-[var(--node-file)]"
                      : "border-[var(--ca-success)] text-[var(--ca-success)]"
              }`}
              title="Aura 1.0 role clustering"
            >
              AURA · {selected.ml_role.toUpperCase()}
            </span>
          )}
          {selected.ml_risk && (
            <span
              className={`border px-1.5 py-1 font-dm text-[8px] ${
                selected.ml_risk === "high"
                  ? "border-[var(--ca-error)] text-[var(--ca-error)]"
                  : selected.ml_risk === "medium"
                    ? "border-[var(--ca-primary)] text-[var(--ca-primary)]"
                    : "border-[var(--ca-success)] text-[var(--ca-success)]"
              }`}
              title="Aura 1.0 refactor-risk prediction"
            >
              REFACTOR RISK · {selected.ml_risk.toUpperCase()}
            </span>
          )}
        </div>
      )}
      {details?.uses && details.uses.length > 0 && (
        <div className="mb-3">
          <span className="font-dm text-[8px] text-[var(--ca-muted)]">USES</span>
          <div className="mt-1 flex flex-wrap gap-1">
            {details.uses.map((use) => (
              <span
                key={use}
                className="border border-[var(--ca-hairline)] px-1.5 py-1 font-dm text-[8px] text-[var(--ca-success)] "
              >
                {use}
              </span>
            ))}
          </div>
        </div>
      )}
      {details?.imports && details.imports.length > 0 && (
        <div className="mb-3">
          <span className="font-dm text-[8px] text-[var(--ca-muted)]">
            LOCAL IMPORTS
          </span>
          {details.imports.map((item) => (
            <div
              key={item.path}
              className="mt-1 truncate font-dm text-[9px] text-[var(--node-file)]"
            >
              {item.path}
              {item.names.length ? ` · ${item.names.join(", ")}` : ""}
            </div>
          ))}
        </div>
      )}
      {details?.external_imports && details.external_imports.length > 0 && (
        <div className="mb-3">
          <span className="font-dm text-[8px] text-[var(--ca-muted)]">
            EXTERNAL PACKAGES
          </span>
          <div className="mt-1 truncate font-dm text-[9px] text-[var(--ca-primary)]">
            {details.external_imports.join(" · ")}
          </div>
        </div>
      )}
      {details?.functions && details.functions.length > 0 && (
        <div className="mb-3">
          <div className="mb-1 flex items-center justify-between">
            <span className="font-dm text-[8px] tracking-[.08em] text-[var(--ca-muted)]">
              FUNCTIONS ({details.functions.length})
            </span>
            <span className="font-dm text-[8px] text-[var(--ca-muted)]">
              click to inspect
            </span>
          </div>
          {details.functions.map((functionDetail) => (
            <FunctionCard
              key={`${selected.id}-${functionDetail.name}-${functionDetail.line_start}`}
              functionDetail={functionDetail}
            />
          ))}
        </div>
      )}
      {crossFileCalls.length > 0 && (
        <div>
          <span className="font-dm text-[8px] tracking-[.08em] text-[var(--ca-muted)]">
            CROSS-FILE CALLS
          </span>
          {crossFileCalls.map((call, index) => (
            <div
              key={`${call.callee_name}-${call.callee_file}-${index}`}
              className="mt-2 border-l-2 border-[var(--ca-primary)] pl-2"
            >
              <div className="font-dm text-[9px] text-[var(--ca-primary)]">
                {call.callee_name}
                {call.callee_file
                  ? ` → ${call.callee_file}`
                  : ` · ${call.external_lib ?? "external"}`}
              </div>
              <div className="mt-1 font-dm text-[8px] leading-[1.4] text-[var(--ca-body)] ">
                {call.description}
              </div>
              {call.params.length > 0 && (
                <div className="mt-1 font-dm text-[8px] text-[var(--ca-success)]">
                  inputs:{" "}
                  {call.params
                    .map(
                      (param, paramIndex) =>
                        `${param} (${call.param_types[paramIndex] ?? "any"})`,
                    )
                    .join(", ")}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function FileTypeIcon({ label }: { label: string }) {
    const { Icon, className } = fileIcon(label);
    return <Icon size={45} strokeWidth={1.2} className={className} />;
}

export default InspectorPanel;
