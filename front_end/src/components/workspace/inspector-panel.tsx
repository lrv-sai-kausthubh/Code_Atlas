import { useState } from "react";
import { ChevronLeft, ChevronRight, Eye, Folder, GitFork, Lock } from "lucide-react";
import { fileIcon, formatBytes, isPreviewable } from "../atlas/file-utils";
import { NODE_COLORS } from "../atlas/atlas-types";
import { createAccessRequest } from "../../services/api";
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
    <div className="mt-5 border border-dashed border-[#39413e] bg-[#141716] p-[14px] light:border-[#c2cfc7] light:bg-[#eef2ef]">
      <div className="flex items-center gap-2 font-dm text-[10px] tracking-[.1em] text-[#f2b84b]">
        <Lock size={16} />
        ACCESS RESTRICTED
      </div>
      <p className="mt-2 font-dm text-[10px] leading-[1.6] text-[#89958f] light:text-[#5c6b64]">
        You can see this module because it participates in the architecture
        graph, but you do not have permission to view its source code. Its
        relationships remain visible under your current role.
      </p>
      <div className="mt-3 flex flex-col gap-1 border-t border-[#2c3331] pt-3 light:border-[#d6dfda]">
        <span className="font-dm text-[9px] text-[#5d6964]">REQUESTED PERMISSION</span>
        <strong className="font-dm text-[11px] text-[#b9c1bd] light:text-[#34473f]">
          Source Code Access
        </strong>
      </div>
      {importsCount > 0 && (
        <div className="mt-1 flex flex-col gap-1 border-t border-[#2c3331] pt-3 light:border-[#d6dfda]">
          <span className="font-dm text-[9px] text-[#5d6964]">RELATIONSHIPS</span>
          <strong className="font-dm text-[11px] text-[#b9c1bd] light:text-[#34473f]">
            {importsCount} import{importsCount === 1 ? "" : "s"} · imported by {importedBy}
          </strong>
        </div>
      )}
      {!sent ? (
        <>
          <textarea
            className="mt-3 w-full resize-none border border-[#303636] bg-[#111313] px-[10px] py-[9px] font-dm text-[10px] leading-[1.5] text-[#dfe5df] outline-none focus:border-[#64d5c4] light:border-[#ccd8d1] light:bg-[#edf2ee] light:text-[#202824]"
            placeholder="Why do you need access? (optional)"
            rows={2}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
          <button
            className="mt-[10px] flex w-full items-center justify-center gap-2 border border-[var(--graph-edge)] bg-[var(--graph-surface)] px-[10px] py-2 font-dm text-[9px] tracking-[.08em] text-[var(--graph-label)] transition-colors hover:border-[#f2b84b] hover:text-[#f2b84b] light:bg-[#f6f8f5]"
            onClick={requestAccess}
            disabled={sending}
          >
            {sending ? "SENDING…" : "REQUEST ACCESS"}
          </button>
        </>
      ) : (
        <div className="mt-3 font-dm text-[10px] text-[#64d5c4]">
          Request sent. The repository owner will review it.
        </div>
      )}
    </div>
  );
}

function FunctionCard({ functionDetail }: { functionDetail: SourceFunction }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-t border-[#2c3331] light:border-[#d6dfda]">
      <button
        className="flex w-full items-center justify-between gap-2 border-0 bg-transparent py-2 text-left font-dm text-[10px] text-[#b9c1bd] light:text-[#34473f]"
        onClick={() => setOpen((value) => !value)}
      >
        <span className="min-w-0 truncate">
          {open ? "▾" : "▸"} {functionDetail.name}()
        </span>
        <span className="shrink-0 text-[8px] text-[#6d7974]">
          L{functionDetail.line_start}
        </span>
      </button>
      {open && (
        <div className="pb-3">
          <p className="mb-2 mt-0 text-[10px] leading-[1.5] text-[#89958f] light:text-[#61716a]">
            {functionDetail.summary}
          </p>
          <div className="mb-2 flex flex-wrap gap-1">
            {functionDetail.inputs.length ? (
              functionDetail.inputs.map((input) => (
                <span
                  key={input.name}
                  className="border border-[#394944] px-1.5 py-1 font-dm text-[8px] text-[#64d5c4] light:border-[#b8c8c0]"
                >
                  {input.name}: {input.type}
                </span>
              ))
            ) : (
              <span className="font-dm text-[8px] text-[#6d7974]">
                No declared inputs
              </span>
            )}
          </div>
          {functionDetail.calls.length > 0 && (
            <div className="mb-2">
              <span className="font-dm text-[8px] tracking-[.08em] text-[#6d7974]">
                CALLS
              </span>
              {functionDetail.calls.map((call) => (
                <div
                  key={`${functionDetail.name}-${call.name}-${call.target}`}
                  className="mt-1 truncate font-dm text-[9px] text-[#b9c1bd] light:text-[#465850]"
                >
                  → {call.name}
                  {call.target ? ` · ${call.target}` : ""}
                </div>
              ))}
            </div>
          )}
          {functionDetail.api_calls.length > 0 && (
            <div className="mb-2">
              <span className="font-dm text-[8px] tracking-[.08em] text-[#6d7974]">
                API / THIRD-PARTY
              </span>
              {functionDetail.api_calls.map((call) => (
                <div
                  key={`${functionDetail.name}-${call.provider}-${call.operation}`}
                  className="mt-1 truncate font-dm text-[9px] text-[#f2b84b]"
                >
                  {call.provider} · {call.operation}
                </div>
              ))}
            </div>
          )}
          <pre className="max-h-[220px] overflow-auto border border-[#303b37] bg-[#111413] p-2 font-dm text-[9px] leading-[1.5] text-[#b9c1bd] light:border-[#ccd8d1] light:bg-[#edf2ee] light:text-[#34473f]">
            {functionDetail.snippet}
          </pre>
        </div>
      )}
    </div>
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
}: {
  graph: ProjectGraph;
  selected: ProjectNode | null;
  projectId: string;
  token: string;
  inspectorCollapsed: boolean;
  onToggleCollapse: () => void;
  onOpenPreview: (node: ProjectNode) => void;
}) {
  const restricted =
    selected?.type === "file" && selected.access?.source === false;
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
                className="mx-[-16px] grid grid-cols-3 gap-2 border-y border-[#2b3030] light:border-[#d6dfda]"
                style={{ marginTop: 23, marginBottom: 25 }}
              >
                <div className="flex flex-col items-center gap-[6px] border-r border-[#2b3030] px-2 py-3 text-center light:border-[#d6dfda]">
                  <strong className="block font-dm text-[17px] leading-none text-[#f1f3ed] light:text-[#202824]">{graph.files}</strong>
                  <span className="block font-dm text-[8px] tracking-[.14em] text-[#5d6964] light:text-[#71807a]">FILES</span>
                </div>
                <div className="flex flex-col items-center gap-[6px] border-r border-[#2b3030] px-2 py-3 text-center light:border-[#d6dfda]">
                  <strong className="block font-dm text-[17px] leading-none text-[#f1f3ed] light:text-[#202824]">{graph.folders}</strong>
                  <span className="block font-dm text-[8px] tracking-[.14em] text-[#5d6964] light:text-[#71807a]">FOLDERS</span>
                </div>
                <div className="flex flex-col items-center gap-[6px] px-2 py-3 text-center">
                  <strong className="block font-dm text-[17px] leading-none text-[#f1f3ed] light:text-[#202824]">{Object.keys(graph.languages).length}</strong>
                  <span className="block font-dm text-[8px] tracking-[.14em] text-[#5d6964] light:text-[#71807a]">LANGUAGES</span>
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
              </div>              <h2 className="my-[5px] text-[20px] [overflow-wrap:anywhere]">
                {selected.label}
              </h2>
              <p className="font-dm text-[11px] leading-[1.5] text-[#6d7974] [overflow-wrap:anywhere] light:text-[#61716a]">
                {selected.path || "/"}
              </p>
              <div className="flex flex-col gap-1.5 border-t border-[#2c3331] py-[13px] light:border-[#d6dfda]">
                <span className="font-dm text-[9px] text-[#5d6964]">
                  NODE TYPE
                </span>
                <strong className="font-dm text-[11px] text-[#b9c1bd]">
                  {selected.type}
                </strong>
              </div>
              {selected.language && (
                <div className="flex flex-col gap-1.5 border-t border-[#2c3331] py-[13px] light:border-[#d6dfda]">
                  <span className="font-dm text-[9px] text-[#5d6964]">
                    LANGUAGE
                  </span>
                  <strong className="font-dm text-[11px] text-[#b9c1bd]">
                    {selected.language}
                  </strong>
                </div>
              )}
              {selected.type === "file" && (
                <>
                  <div className="flex flex-col gap-1.5 border-t border-[#2c3331] py-[13px] light:border-[#d6dfda]">
                    <span className="font-dm text-[9px] text-[#5d6964]">
                      LINES
                    </span>
                    <strong className="font-dm text-[11px] text-[#b9c1bd]">
                      {selected.lines?.toLocaleString() ?? "-"}
                    </strong>
                  </div>
                  <div className="flex flex-col gap-1.5 border-t border-[#2c3331] py-[13px] light:border-[#d6dfda]">
                    <span className="font-dm text-[9px] text-[#5d6964]">
                      SIZE
                    </span>
                    <strong className="font-dm text-[11px] text-[#b9c1bd]">
                      {selected.size_bytes === undefined
                        ? "-"
                        : formatBytes(selected.size_bytes)}
                    </strong>
                  </div>
                </>
              )}
              <div className="flex flex-col gap-1.5 border-t border-[#2c3331] py-[13px] light:border-[#d6dfda]">
                <span className="font-dm text-[9px] text-[#5d6964]">
                  RELATIONSHIP
                </span>
                <strong className="font-dm text-[11px] text-[#b9c1bd]">
                  CONTAINS / IMPORTS
                </strong>
              </div>
              {projectId && !restricted && isPreviewable(selected) && (
                <button
                  className="mt-[14px] flex w-full items-center justify-center gap-2 border border-[var(--graph-edge)] bg-[var(--graph-surface)] px-[10px] py-2 font-dm text-[9px] tracking-[.08em] text-[var(--graph-label)] transition-colors hover:border-[#f2b84b] hover:text-[#f2b84b] light:bg-[#f6f8f5]"
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
                  <SourceIntelligence graph={graph} selected={selected} />
                ))}
            </>
          ) : (
            <p className="mt-[50px] font-dm text-xs leading-[1.6] text-[#6f7975] light:text-[#61716a]">
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
  if (!details && crossFileCalls.length === 0) return null;
  return (
    <section className="mt-5 border-t border-[#2c3331] pt-4 light:border-[#d6dfda]">
      <div className="mb-3 font-dm text-[9px] tracking-[.1em] text-[#64d5c4]">
        SOURCE INTELLIGENCE
      </div>
      {details?.uses && details.uses.length > 0 && (
        <div className="mb-3">
          <span className="font-dm text-[8px] text-[#6d7974]">USES</span>
          <div className="mt-1 flex flex-wrap gap-1">
            {details.uses.map((use) => (
              <span
                key={use}
                className="border border-[#39534c] px-1.5 py-1 font-dm text-[8px] text-[#64d5c4] light:border-[#b8c8c0]"
              >
                {use}
              </span>
            ))}
          </div>
        </div>
      )}
      {details?.imports && details.imports.length > 0 && (
        <div className="mb-3">
          <span className="font-dm text-[8px] text-[#6d7974]">
            LOCAL IMPORTS
          </span>
          {details.imports.map((item) => (
            <div
              key={item.path}
              className="mt-1 truncate font-dm text-[9px] text-[#9ca9ff]"
            >
              {item.path}
              {item.names.length ? ` · ${item.names.join(", ")}` : ""}
            </div>
          ))}
        </div>
      )}
      {details?.external_imports && details.external_imports.length > 0 && (
        <div className="mb-3">
          <span className="font-dm text-[8px] text-[#6d7974]">
            EXTERNAL PACKAGES
          </span>
          <div className="mt-1 truncate font-dm text-[9px] text-[#f2b84b]">
            {details.external_imports.join(" · ")}
          </div>
        </div>
      )}
      {details?.functions && details.functions.length > 0 && (
        <div className="mb-3">
          <div className="mb-1 flex items-center justify-between">
            <span className="font-dm text-[8px] tracking-[.08em] text-[#6d7974]">
              FUNCTIONS ({details.functions.length})
            </span>
            <span className="font-dm text-[8px] text-[#6d7974]">
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
          <span className="font-dm text-[8px] tracking-[.08em] text-[#6d7974]">
            CROSS-FILE CALLS
          </span>
          {crossFileCalls.map((call, index) => (
            <div
              key={`${call.callee_name}-${call.callee_file}-${index}`}
              className="mt-2 border-l-2 border-[#f2b84b] pl-2"
            >
              <div className="font-dm text-[9px] text-[#f2b84b]">
                {call.callee_name}
                {call.callee_file
                  ? ` → ${call.callee_file}`
                  : ` · ${call.external_lib ?? "external"}`}
              </div>
              <div className="mt-1 font-dm text-[8px] leading-[1.4] text-[#89958f] light:text-[#61716a]">
                {call.description}
              </div>
              {call.params.length > 0 && (
                <div className="mt-1 font-dm text-[8px] text-[#64d5c4]">
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
