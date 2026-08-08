import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ChangeEvent, CSSProperties, ReactNode } from "react";
import {
  applyNodeChanges,
  Background,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
  ReactFlowProvider,
  SelectionMode,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from "@xyflow/react";
import type {
  Edge,
  Node,
  NodeChange,
  NodeProps,
  OnNodeDrag,
  XYPosition,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import ParsingScreen from "../components/parsing";
import StateLab from "../components/state-lab";
import { projectFileUrl } from "../services/api";
import { toastEmpty, toastProcessing } from "../services/toast";
import type {
  FunctionCall,
  ProjectGraph,
  ProjectNode,
  RepositoryAnalysis,
} from "../types/project";

/* ── Colour palette ─────────────────────────────────────────────────────────── */

const colors: Record<ProjectNode["type"], string> = {
  project: "#f2b84b",
  folder: "#64d5c4",
  file: "#9ca9ff",
};

const PANEL =
  "min-w-0 border border-[#2b3030] bg-[#171a1a] light:border-[#d6dfda] light:bg-[#f6f8f5]";
const PANEL_HEADING =
  "flex justify-between font-dm text-[10px] tracking-[.1em] text-[#79817e] light:text-[#71807a]";
const PANEL_HEADING_ACTIONS = "flex items-center gap-2";
const PANEL_COLLAPSE =
  "inline-flex h-[22px] w-[22px] items-center justify-center border border-transparent bg-transparent font-dm text-[10px] text-[#79817e] transition-colors hover:border-[#39413e] hover:text-[#f2b84b] light:border-[#d6dfda] light:text-[#71807a] [&_.material-symbols-outlined]:text-[16px]";
const MUTED = "text-[#4e5854] light:text-[#71807a]";
const LIVE_DOT =
  "mr-2 inline-block h-1.5 w-1.5 rounded-full bg-[#64d5c4] shadow-[0_0_12px_#64d5c4]";

/* ── Types ──────────────────────────────────────────────────────────────────── */

type AtlasNodeData = ProjectNode & {
  onSelect: (node: ProjectNode) => void;
  onToggle: (nodeId: string) => void;
  selected: boolean;
};
type AtlasNode = Node<AtlasNodeData, "atlas">;
type NodeMovement = { id: string; delta: XYPosition };
/** Imperative handle exposed by GraphCanvas so the explorer can pan/flash nodes. */
type GraphCanvasHandle = { focusNode: (nodeId: string) => void };

/* ── File icon helpers ──────────────────────────────────────────────────────── */

function fileIcon(label: string) {
  const extension = label.toLowerCase().split(".").pop() ?? "";
  const icons: Record<string, { name: string; className: string }> = {
    html: { name: "html", className: "text-[#ef8354]" },
    css: { name: "css", className: "text-[#67a7f8]" },
    scss: { name: "css", className: "text-[#67a7f8]" },
    js: { name: "javascript", className: "text-[#e9c44a]" },
    jsx: { name: "javascript", className: "text-[#e9c44a]" },
    ts: { name: "code", className: "text-[#5a9ee8]" },
    tsx: { name: "code", className: "text-[#5a9ee8]" },
    py: { name: "data_object", className: "text-[#d8bb55]" },
    json: { name: "data_object", className: "text-[#bb9be9]" },
    md: { name: "article", className: "text-[#b0bab4]" },
    svg: { name: "image", className: "text-[#ef9d56]" },
    png: { name: "image", className: "text-[#9ca9ff]" },
    jpg: { name: "image", className: "text-[#9ca9ff]" },
    jpeg: { name: "image", className: "text-[#9ca9ff]" },
    gif: { name: "image", className: "text-[#9ca9ff]" },
    webp: { name: "image", className: "text-[#9ca9ff]" },
    pdf: { name: "picture_as_pdf", className: "text-[#f17c71]" },
    zip: { name: "folder_zip", className: "text-[#bb9be9]" },
    tar: { name: "folder_zip", className: "text-[#bb9be9]" },
    gz: { name: "folder_zip", className: "text-[#bb9be9]" },
    txt: { name: "description", className: "text-[#9ca9ff]" },
    yml: { name: "tune", className: "text-[#bb9be9]" },
    yaml: { name: "tune", className: "text-[#bb9be9]" },
    toml: { name: "tune", className: "text-[#bb9be9]" },
    lock: { name: "enhanced_encryption", className: "text-[#bb9be9]" },
  };
  return (
    icons[extension] ?? { name: "description", className: "text-[#b0bab4]" }
  );
}

const IMAGE_EXTENSIONS = new Set([
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "svg",
  "bmp",
  "ico",
  "avif",
]);
const PDF_EXTENSION = "pdf";

function isPreviewable(node: ProjectNode) {
  if (node.type !== "file") return false;
  const extension = node.label.toLowerCase().split(".").pop() ?? "";
  return IMAGE_EXTENSIONS.has(extension) || extension === PDF_EXTENSION;
}

function getFilename(path: string): string {
  return path.split("/").pop() ?? path;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/* ── Atlas Node (React Flow custom node) ────────────────────────────────────── */

function AtlasNodeView({ data }: NodeProps<AtlasNode>) {
  const color = colors[data.type];
  return (
    <div
      className={`atlas-node atlas-node-${data.type} ${data.selected ? "is-selected" : ""}`}
      style={{ "--node-color": color } as CSSProperties}
      onClick={() => data.onSelect(data)}
    >
      <Handle type="target" position={Position.Top} className="atlas-handle" />
      <div
        className={`atlas-node-dot ${data.type === "file" ? fileIcon(data.label).className : ""}`}
      >
        <span className="material-symbols-outlined">
          {data.type === "project"
            ? "account_tree"
            : data.type === "folder"
              ? "folder"
              : fileIcon(data.label).name}
        </span>
      </div>
      <div className="atlas-node-label" title={data.path || data.label}>
        {data.label}
      </div>
      {data.type !== "file" && (
        <div className="atlas-node-kind">{data.type}</div>
      )}
      <Handle
        type="source"
        position={Position.Bottom}
        className="atlas-handle"
      />
    </div>
  );
}

const nodeTypes = { atlas: AtlasNodeView };

/* ── File Preview (images / PDFs in inspector) ──────────────────────────────── */

function FilePreview({
  node,
  projectId,
}: {
  node: ProjectNode;
  projectId: string;
}) {
  const extension = node.label.toLowerCase().split(".").pop() ?? "";
  const src = projectFileUrl(projectId, node.path);
  const isImage = IMAGE_EXTENSIONS.has(extension);
  return (
    <div className="mt-[14px] border border-[var(--graph-edge)] bg-[#101314] light:bg-[#f6f8f5]">
      <div className="flex items-center justify-between border-b border-[var(--graph-edge)] px-[10px] py-2 font-dm text-[9px] tracking-[.08em] text-[var(--graph-label)]">
        <span>PREVIEW · {extension.toUpperCase()}</span>
        <a href={src} target="_blank" rel="noreferrer" className="text-[#f2b84b] no-underline hover:underline">
          OPEN
        </a>
      </div>
      {isImage ? (
        <img
          src={src}
          alt={node.label}
          className="block w-full max-h-[240px] object-contain bg-[repeating-conic-gradient(#14181a_0%_25%,#101314_0%_50%)] bg-[size:18px_18px]"
        />
      ) : (
        <iframe
          src={src}
          title={node.label}
          className="block w-full h-[300px] border-0 bg-[#dfe2eb]"
        />
      )}
    </div>
  );
}

/* ── Function Call Panel ────────────────────────────────────────────────────── */

function FunctionCallRow({ call }: { call: FunctionCall }) {
  return (
    <div className="fn-call-row">
      <div className="fn-call-header">
        <span className="fn-call-badge">{call.callee_name}</span>
        {call.is_external && call.external_lib && (
          <span className="fn-ext-badge">{call.external_lib}</span>
        )}
        {!call.is_external && call.callee_file && (
          <span className="fn-target-file">→ {getFilename(call.callee_file)}</span>
        )}
      </div>
      {call.params.length > 0 && (
        <div className="fn-params">
          {call.params.map((param, i) => (
            <span key={i} className="fn-param-chip">
              <span className="fn-param-name">{param}</span>
              <span className={`fn-type-chip fn-type-${(call.param_types[i] ?? "any").toLowerCase()}`}>
                {call.param_types[i] ?? "any"}
              </span>
            </span>
          ))}
        </div>
      )}
      <p className="fn-call-desc">{call.description}</p>
    </div>
  );
}

function FunctionCallsPanel({
  filePath,
  functionCalls,
}: {
  filePath: string;
  functionCalls: FunctionCall[];
}) {
  const calls = useMemo(
    () => functionCalls.filter((c) => c.caller_file === filePath),
    [functionCalls, filePath],
  );
  const localCalls = calls.filter((c) => !c.is_external);
  const externalCalls = calls.filter((c) => c.is_external);
  if (!calls.length) return null;
  return (
    <div className="fn-panel">
      <div className="fn-panel-head">
        FUNCTION CALLS<span className="fn-count">{calls.length}</span>
      </div>
      {localCalls.length > 0 && (
        <>
          <div className="fn-section-label">OUTBOUND · {localCalls.length}</div>
          {localCalls.map((call, i) => (
            <FunctionCallRow key={i} call={call} />
          ))}
        </>
      )}
      {externalCalls.length > 0 && (
        <>
          <div className="fn-section-label">LIBRARY USAGE · {externalCalls.length}</div>
          {externalCalls.map((call, i) => (
            <FunctionCallRow key={i} call={call} />
          ))}
        </>
      )}
    </div>
  );
}

/* ── Analysis Drawer ────────────────────────────────────────────────────────── */

function AnalysisDrawer({ analysis }: { analysis: RepositoryAnalysis }) {
  const scoreColor =
    analysis.health_score >= 80
      ? "#64d5c4"
      : analysis.health_score >= 60
        ? "#f2b84b"
        : "#f17c71";
  const issues = analysis.security_issues ?? [];
  return (
    <section className="flex-[0_0_auto] overflow-y-auto p-[18px] bg-[color-mix(in_srgb,var(--graph-surface)_96%,#64d5c4)] light:bg-[#f6f8f5]">
      <div className="flex items-center gap-4">
        <div
          className="health-score"
          style={
            {
              "--score-color": scoreColor,
              "--score-angle": `${analysis.health_score * 3.6}deg`,
            } as CSSProperties
          }
        >
          <strong>{analysis.health_score}</strong>
          <span>/ 100</span>
        </div>
        <div>
          <p className="m-0 font-dm text-[9px] tracking-[.1em] text-[#64d5c4]">
            ARCHITECTURE HEALTH
          </p>
          <h2 className="my-1 text-lg text-[var(--graph-label)] light:text-[#34473f]">
            {analysis.health_score >= 80
              ? "Healthy foundation"
              : analysis.health_score >= 60
                ? "Worth investigating"
                : "Needs attention"}
          </h2>
          <p className="m-0 font-dm text-[9px] text-[var(--graph-label)] opacity-80">
            Calculated from dependency cycles, orphan files, oversized modules,
            and hardcoded secrets.
          </p>
        </div>
      </div>
      <div className="mt-[18px] grid grid-cols-4 gap-[7px] max-[850px]:grid-cols-2">
        <div className="border border-[color-mix(in_srgb,var(--graph-edge)_70%,transparent)] p-[11px]">
          <span className="block font-dm text-[8px] text-[var(--graph-label)]">
            LINES OF CODE
          </span>
          <strong className="mt-[7px] block font-dm text-base text-[#f2b84b] light:text-[#34473f]">
            {analysis.total_lines.toLocaleString()}
          </strong>
        </div>
        <div className="border border-[color-mix(in_srgb,var(--graph-edge)_70%,transparent)] p-[11px]">
          <span className="block font-dm text-[8px] text-[var(--graph-label)]">
            IMPORTS
          </span>
          <strong className="mt-[7px] block font-dm text-base text-[#f2b84b] light:text-[#34473f]">
            {analysis.total_imports}
          </strong>
        </div>
        <div className="border border-[color-mix(in_srgb,var(--graph-edge)_70%,transparent)] p-[11px]">
          <span className="block font-dm text-[8px] text-[var(--graph-label)]">
            AVG DEPENDENCIES
          </span>
          <strong className="mt-[7px] block font-dm text-base text-[#f2b84b] light:text-[#34473f]">
            {analysis.average_dependencies}
          </strong>
        </div>
        <div className="border border-[color-mix(in_srgb,var(--graph-edge)_70%,transparent)] p-[11px]">
          <span className="block font-dm text-[8px] text-[var(--graph-label)]">
            LONGEST CHAIN
          </span>
          <strong className="mt-[7px] block font-dm text-base text-[#f2b84b] light:text-[#34473f]">
            {analysis.longest_import_chain.length} files
          </strong>
        </div>
      </div>
      <div className="mt-[7px] grid grid-cols-3 gap-[7px] max-[850px]:grid-cols-1">
        <div className="min-w-0 border-t border-[color-mix(in_srgb,var(--graph-edge)_70%,transparent)] px-[11px] py-[10px]">
          <span className="block font-dm text-[9px] text-[var(--graph-label)]">
            CIRCULAR DEPENDENCIES
          </span>
          <strong
            className={`my-[6px] block truncate font-dm text-[11px] text-[var(--graph-label)] light:text-[#34473f] ${analysis.circular_dependencies.length ? "text-[#f17c71]" : "text-[#64d5c4]"}`}
          >
            {analysis.circular_dependencies.length || "None detected"}
          </strong>
          {analysis.circular_dependencies.length > 0 && (
            <small className="m-0 block truncate font-dm text-[9px] text-[var(--graph-label)]">
              {analysis.circular_dependencies[0].join(" → ")}
            </small>
          )}
        </div>
        <div className="min-w-0 border-t border-[color-mix(in_srgb,var(--graph-edge)_70%,transparent)] px-[11px] py-[10px]">
          <span className="block font-dm text-[9px] text-[var(--graph-label)]">
            ORPHAN FILES
          </span>
          <strong
            className={`my-[6px] block truncate font-dm text-[11px] text-[var(--graph-label)] light:text-[#34473f] ${analysis.orphan_files.length ? "text-[#f2b84b]" : "text-[#64d5c4]"}`}
          >
            {analysis.orphan_files.length}
          </strong>
          {analysis.orphan_files.length > 0 && (
            <small className="m-0 block truncate font-dm text-[9px] text-[var(--graph-label)]">
              {analysis.orphan_files.slice(0, 2).join(" · ")}
              {analysis.orphan_files.length > 2 ? " · ..." : ""}
            </small>
          )}
        </div>
        <div className="min-w-0 border-t border-[color-mix(in_srgb,var(--graph-edge)_70%,transparent)] px-[11px] py-[10px]">
          <span className="block font-dm text-[9px] text-[var(--graph-label)]">
            LARGEST FILE
          </span>
          <strong className="my-[6px] block truncate font-dm text-[11px] text-[var(--graph-label)] light:text-[#34473f]">
            {analysis.largest_file?.path ?? "-"}
          </strong>
          <small className="m-0 block truncate font-dm text-[9px] text-[var(--graph-label)]">
            {analysis.largest_file
              ? `${analysis.largest_file.lines.toLocaleString()} lines · ${formatBytes(analysis.largest_file.size_bytes)}`
              : "No files"}
          </small>
        </div>
      </div>
      <div className="mt-[7px] border-t border-[color-mix(in_srgb,var(--graph-edge)_70%,transparent)] pt-3">
        <div className="flex items-baseline gap-[10px]">
          <span className="block font-dm text-[9px] text-[var(--graph-label)]">
            HARDCODED SECRETS
          </span>
          <strong className={`font-dm text-[11px] ${issues.length ? "text-[#f17c71]" : "text-[#64d5c4]"}`}>
            {issues.length ? `${issues.length} found` : "None detected"}
          </strong>
        </div>
        {issues.length > 0 && (
          <ul className="mt-[10px] mb-0 flex list-none flex-col gap-1.5 p-0">
            {issues.slice(0, 12).map((issue, index) => (
              <li
                key={index}
                className="flex items-center gap-[10px] border-l-2 border-[#f17c71] bg-[color-mix(in_srgb,var(--graph-surface)_70%,#f17c71)] px-[10px] py-2"
              >
                <span className="shrink-0 font-dm text-[9px] text-[#f17c71]">
                  {issue.type}
                </span>
                <span className="shrink-0 font-dm text-[9px] text-[var(--graph-label)] opacity-80">
                  {issue.file}:{issue.line}
                </span>
                <code className="min-w-0 flex-1 truncate font-dm text-[10px] text-[var(--graph-label)]">
                  {issue.snippet}
                </code>
              </li>
            ))}
          </ul>
        )}
        {issues.length > 12 && (
          <small className="mt-1.5 block font-dm text-[9px] text-[var(--graph-label)] opacity-60">
            +{issues.length - 12} more hidden
          </small>
        )}
      </div>
    </section>
  );
}

/* ── Explorer Sidebar Tree ──────────────────────────────────────────────────── */

function ExplorerTree({
  graph,
  query,
  selected,
  collapsed,
  onSelect,
  onToggle,
}: {
  graph: ProjectGraph;
  query: string;
  selected: ProjectNode | null;
  collapsed: Set<string>;
  onSelect: (node: ProjectNode) => void;
  onToggle: (nodeId: string) => void;
}) {
  const children = new Map<string, ProjectNode[]>();
  graph.edges
    .filter((edge) => edge.relation !== "IMPORTS")
    .forEach((edge) => {
      const child = graph.nodes.find((node) => node.id === edge.target);
      if (child)
        children.set(edge.source, [
          ...(children.get(edge.source) ?? []),
          child,
        ]);
    });
  const renderNode = (node: ProjectNode, depth: number): ReactNode => {
    const isFolder = node.type === "folder";
    const icon = isFolder
      ? {
          name: collapsed.has(node.id) ? "folder" : "folder_open",
          className: "text-[#64d5c4]",
        }
      : fileIcon(node.label);
    return (
      <div key={node.id}>
        <button
          className={`min-h-[28px] w-full flex items-center gap-2 border-0 bg-transparent px-1 py-[5px] text-left font-dm text-[11px] text-[#969f9b] transition-colors hover:bg-[#242d2b] hover:text-[#f1f3ed] light:text-[#56645e] light:hover:bg-[#e3ece7] light:hover:text-[#202824] ${selected?.id === node.id ? "bg-[#242d2b] text-[#f1f3ed] light:bg-[#e3ece7] light:text-[#202824]" : ""}`}
          style={{ paddingLeft: `${4 + depth * 14}px` }}
          onClick={() => {
            onSelect(node);
            if (isFolder) onToggle(node.id);
          }}
        >
          <span className={`flex-[0_0_24px] w-6 text-center font-dm text-[10px] font-medium [&_.material-symbols-outlined]:text-[20px] ${icon.className}`}>
            <span className="material-symbols-outlined">{icon.name}</span>
          </span>
          <span className="min-w-0 truncate">{node.label}</span>
          <small className="ml-auto shrink-0 text-[8px] text-[#4f5d59] light:text-[#687870]">
            {node.type}
          </small>
        </button>
        {isFolder &&
          !collapsed.has(node.id) &&
          (children.get(node.id) ?? []).map((child) =>
            renderNode(child, depth + 1),
          )}
      </div>
    );
  };
  if (query)
    return (
      <>
        {graph.nodes
          .filter(
            (node) =>
              node.label.toLowerCase().includes(query.toLowerCase()) &&
              node.id !== "root",
          )
          .map((node) => renderNode(node, 0))}
      </>
    );
  return <>{(children.get("root") ?? []).map((node) => renderNode(node, 0))}</>;
}

/* ── Graph Layout ───────────────────────────────────────────────────────────── */

function makeLayout(
  graph: ProjectGraph,
  onSelect: (node: ProjectNode) => void,
  onToggle: (nodeId: string) => void,
  compact: boolean,
  positionOffsets: ReadonlyMap<string, XYPosition>,
) {
  const children = new Map<string, string[]>();
  graph.edges
    .filter((edge) => edge.relation !== "IMPORTS")
    .forEach((edge) => {
      const group = children.get(edge.source) ?? [];
      group.push(edge.target);
      children.set(edge.source, group);
    });
  const nodesById = new Map(graph.nodes.map((node) => [node.id, node]));
  const widths = new Map<string, number>();
  const measure = (nodeId: string): number => {
    const childIds = children.get(nodeId) ?? [];
    const width = childIds.length
      ? childIds.reduce((sum, childId) => sum + measure(childId), 0)
      : 1;
    widths.set(nodeId, width);
    return width;
  };
  measure("root");
  const nodes: AtlasNode[] = [];
  const place = (nodeId: string, depth: number, start: number) => {
    const node = nodesById.get(nodeId);
    if (!node) return;
    const width = widths.get(nodeId) ?? 1;
    const childIds = children.get(nodeId) ?? [];
    const center = start + width / 2;
    const offset = positionOffsets.get(node.id) ?? { x: 0, y: 0 };
    nodes.push({
      id: node.id,
      type: "atlas",
      position: {
        x: center * (compact ? 112 : 150) + offset.x,
        y: depth * (compact ? 122 : 160) + offset.y,
      },
      data: { ...node, onSelect, onToggle, selected: false },
    });
    let childStart = start;
    childIds.forEach((childId) => {
      place(childId, depth + 1, childStart);
      childStart += widths.get(childId) ?? 1;
    });
  };
  place("root", 0, -(widths.get("root") ?? 1) / 2);

  const cycleNodes = new Set(
    graph.analysis.circular_dependencies.flatMap((cycle) =>
      cycle.map((path) => `file:${path}`),
    ),
  );
  const edges: Edge[] = graph.edges.map((edge) => {
    const isImport = edge.relation === "IMPORTS";
    const isCycle =
      isImport && cycleNodes.has(edge.source) && cycleNodes.has(edge.target);
    const edgeColor = isCycle
      ? "var(--cycle-edge)"
      : isImport
        ? "var(--import-edge)"
        : "var(--graph-edge)";
    return {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: isImport ? "bezier" : "smoothstep",
      animated: isImport,
      label: isCycle ? "CYCLE" : isImport ? "IMPORTS" : undefined,
      markerEnd: isImport
        ? { type: MarkerType.ArrowClosed, color: edgeColor }
        : undefined,
      style: {
        stroke: edgeColor,
        strokeWidth: isImport ? 1.8 : 1.2,
        strokeDasharray: isImport ? "5 4" : undefined,
      },
      labelStyle: {
        fill: "var(--graph-label)",
        fontSize: 8,
        fontFamily: "DM Mono, monospace",
      },
      labelBgStyle: { fill: "var(--graph-surface)", fillOpacity: 0.9 },
    };
  });
  return { nodes, edges };
}

/* ── Graph Canvas (React Flow wrapper) ──────────────────────────────────────── */

const GraphCanvas = forwardRef<
  GraphCanvasHandle,
  {
    graph: ProjectGraph;
    collapsed: Set<string>;
    selected: ProjectNode | null;
    onSelect: (node: ProjectNode) => void;
    onToggle: (nodeId: string) => void;
    compact: boolean;
    positionOffsets: ReadonlyMap<string, XYPosition>;
    onMoveNodes: (movements: NodeMovement[]) => void;
  }
>(function GraphCanvas(
  { graph, collapsed, selected, onSelect, onToggle, compact, positionOffsets, onMoveNodes },
  ref,
) {
  const { fitView, zoomIn, zoomOut } = useReactFlow();
  const parentById = useMemo(() => {
    const parents = new Map<string, string>();
    graph.edges
      .filter((edge) => edge.relation !== "IMPORTS")
      .forEach((edge) => parents.set(edge.target, edge.source));
    return parents;
  }, [graph]);
  const hiddenIds = useMemo(() => {
    const hidden = new Set<string>();
    graph.nodes.forEach((node) => {
      let parent = parentById.get(node.id);
      while (parent) {
        if (collapsed.has(parent)) {
          hidden.add(node.id);
          break;
        }
        parent = parentById.get(parent);
      }
    });
    return hidden;
  }, [collapsed, graph.nodes, parentById]);
  const initial = useMemo(
    () => makeLayout(graph, onSelect, onToggle, compact, positionOffsets),
    [compact, graph, onSelect, onToggle, positionOffsets],
  );
  const [nodes, setNodes] = useNodesState<AtlasNode>(initial.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initial.edges);
  const [zoom, setZoom] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const hasFittedInitialView = useRef(false);
  const previousCompact = useRef(compact);
  const nodesRef = useRef(nodes);
  const dragStart = useRef<Map<string, XYPosition>>(new Map());

  /* Expose focusNode() to parent via ref so the explorer sidebar can pan + flash */
  useImperativeHandle(ref, () => ({
    focusNode: (nodeId: string) => {
      fitView({ nodes: [{ id: nodeId }], padding: 0.35, duration: 500 });
      setTimeout(() => {
        const el = document.querySelector(`[data-id="${nodeId}"] .atlas-node`);
        if (el) {
          el.classList.add("is-flashing");
          setTimeout(() => el.classList.remove("is-flashing"), 1600);
        }
      }, 200);
    },
  }), [fitView]);

  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (!hasFittedInitialView.current) {
        fitView({ padding: 0.18, duration: 350 });
        hasFittedInitialView.current = true;
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [fitView]);

  useEffect(() => {
    const reflow = previousCompact.current !== compact;
    previousCompact.current = compact;
    setNodes((currentNodes) => {
      const currentById = new Map(currentNodes.map((node) => [node.id, node]));
      return initial.nodes.map((node) => {
        const existing = currentById.get(node.id);
        const nextNode =
          existing && !reflow ? { ...node, position: existing.position } : node;
        return { ...nextNode, hidden: hiddenIds.has(node.id) };
      });
    });
    setEdges(
      initial.edges.map((edge) => ({
        ...edge,
        hidden: hiddenIds.has(edge.source) || hiddenIds.has(edge.target),
      })),
    );
  }, [compact, hiddenIds, initial, setEdges, setNodes]);

  useEffect(() => {
    setNodes((currentNodes) =>
      currentNodes.map((node) => ({
        ...node,
        data: { ...node.data, selected: node.id === selected?.id },
      })),
    );
  }, [selected?.id, setNodes]);

  const descendantsById = useMemo(() => {
    const descendants = new Map<string, Set<string>>();
    graph.nodes.forEach((ancestor) => {
      const members = new Set<string>();
      graph.nodes.forEach((candidate) => {
        let parent = parentById.get(candidate.id);
        while (parent) {
          if (parent === ancestor.id) {
            members.add(candidate.id);
            break;
          }
          parent = parentById.get(parent);
        }
      });
      descendants.set(ancestor.id, members);
    });
    return descendants;
  }, [graph.nodes, parentById]);

  const onNodesChange = useCallback(
    (changes: NodeChange<AtlasNode>[]) => {
      const currentNodes = nodesRef.current;
      const nextNodes = applyNodeChanges(changes, currentNodes);
      const movedAncestors = changes
        .filter((change) => change.type === "position")
        .flatMap((change) => {
          const before = currentNodes.find((node) => node.id === change.id);
          const after = nextNodes.find((node) => node.id === change.id);
          if (
            !before ||
            !after ||
            (before.position.x === after.position.x &&
              before.position.y === after.position.y)
          )
            return [];
          const delta = {
            x: after.position.x - before.position.x,
            y: after.position.y - before.position.y,
          };
          return before.data.type === "folder" || before.data.type === "project"
            ? [{ id: change.id, delta }]
            : [];
        });
      const changedPositionIds = new Set(
        changes
          .filter((change) => change.type === "position")
          .map((change) => change.id),
      );
      const descendantMovement = new Map<string, XYPosition>();
      movedAncestors.forEach(({ id, delta }) => {
        descendantsById.get(id)?.forEach((descendantId) => {
          const currentDelta = descendantMovement.get(descendantId) ?? {
            x: 0,
            y: 0,
          };
          descendantMovement.set(descendantId, {
            x: currentDelta.x + delta.x,
            y: currentDelta.y + delta.y,
          });
        });
      });
      const translatedNodes = descendantMovement.size
        ? nextNodes.map((node) => {
            if (changedPositionIds.has(node.id)) return node;
            const delta = descendantMovement.get(node.id);
            return delta
              ? {
                  ...node,
                  position: {
                    x: node.position.x + delta.x,
                    y: node.position.y + delta.y,
                  },
                }
              : node;
          })
        : nextNodes;
      nodesRef.current = translatedNodes;
      setNodes(translatedNodes);
    },
    [descendantsById, setNodes],
  );

  const onNodeDragStart: OnNodeDrag<AtlasNode> = useCallback(
    (_, _node, draggedNodes) => {
      setIsDragging(true);
      dragStart.current = new Map(
        draggedNodes.map((draggedNode) => [
          draggedNode.id,
          { ...draggedNode.position },
        ]),
      );
    },
    [],
  );

  const onNodeDragStop: OnNodeDrag<AtlasNode> = useCallback(
    (_, _node, draggedNodes) => {
      const starts = dragStart.current;
      dragStart.current = new Map();
      setIsDragging(false);
      const movements = draggedNodes.flatMap((draggedNode) => {
        const start = starts.get(draggedNode.id);
        if (!start) return [];
        const delta = {
          x: draggedNode.position.x - start.x,
          y: draggedNode.position.y - start.y,
        };
        return delta.x || delta.y ? [{ id: draggedNode.id, delta }] : [];
      });
      if (movements.length) onMoveNodes(movements);
    },
    [onMoveNodes],
  );

  return (
    <div className="relative min-h-0 flex-1 bg-[var(--graph-surface)]">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStart={onNodeDragStart}
        onNodeDragStop={onNodeDragStop}
        onNodeClick={(_, node) => {
          onSelect(node.data);
          if (node.data.type === "folder") onToggle(node.id);
        }}
        nodesDraggable
        nodesConnectable={false}
        selectionOnDrag
        selectionMode={SelectionMode.Partial}
        panOnDrag={[1, 2]}
        onMove={(_, viewport) => setZoom(viewport.zoom)}
        minZoom={0.08}
        maxZoom={2.5}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="var(--graph-grid)" gap={28} size={1} />
        <Controls showInteractive={false} />
        {!isDragging && (
          <MiniMap
            nodeColor={(node) => colors[(node.data as AtlasNodeData).type]}
            maskColor="var(--minimap-mask)"
            pannable
            zoomable
          />
        )}
      </ReactFlow>
      <div className="pointer-events-none absolute bottom-3 left-5 z-[5] font-dm text-[9px] text-[#56615c] light:text-[#687870]">
        DRAG ON CANVAS TO LASSO <span>·</span> MIDDLE-CLICK TO PAN{" "}
        <span>·</span> DRAG NODES
      </div>
      <div className="absolute top-[14px] right-[160px] z-[5] font-dm text-[10px] text-[var(--graph-label)] max-[850px]:right-[126px]">
        {Math.round(zoom * 100)}%
      </div>
      <div className="absolute top-[10px] right-5 z-[6] flex gap-1.5">
        <button className="border border-[var(--graph-edge)] bg-[var(--graph-surface)] px-[9px] py-[6px] font-dm text-[10px] text-[var(--graph-label)] transition-colors hover:border-[#f2b84b] hover:text-[#f2b84b] light:border-[#b8c8c0] light:bg-[#f6f8f5] light:text-[#405149] light:hover:bg-[#e3ece7]" onClick={() => zoomIn({ duration: 200 })}>
          +
        </button>
        <button className="border border-[var(--graph-edge)] bg-[var(--graph-surface)] px-[9px] py-[6px] font-dm text-[10px] text-[var(--graph-label)] transition-colors hover:border-[#f2b84b] hover:text-[#f2b84b] light:border-[#b8c8c0] light:bg-[#f6f8f5] light:text-[#405149] light:hover:bg-[#e3ece7]" onClick={() => zoomOut({ duration: 200 })}>
          −
        </button>
        <button className="border border-[var(--graph-edge)] bg-[var(--graph-surface)] px-[9px] py-[6px] font-dm text-[10px] text-[var(--graph-label)] transition-colors hover:border-[#f2b84b] hover:text-[#f2b84b] light:border-[#b8c8c0] light:bg-[#f6f8f5] light:text-[#405149] light:hover:bg-[#e3ece7]" onClick={() => fitView({ padding: 0.18, duration: 350 })}>
          FIT
        </button>
      </div>
    </div>
  );
});

/* ── Home Page (root workspace) ─────────────────────────────────────────────── */

function Home() {
  const inputRef = useRef<HTMLInputElement>(null);
  /** Ref to the graph canvas — used to programmatically pan + flash a node. */
  const graphRef = useRef<GraphCanvasHandle>(null);

  const [graph, setGraph] = useState<ProjectGraph | null>(null);
  const [parsingFile, setParsingFile] = useState<File | null>(null);
  const [parsingUploadId, setParsingUploadId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [selected, setSelected] = useState<ProjectNode | null>(null);
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [compact, setCompact] = useState(false);
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [positionOffsets, setPositionOffsets] = useState<
    Map<string, XYPosition>
  >(new Map());
  const [theme, setTheme] = useState<"dark" | "light">(
    () =>
      (localStorage.getItem("codeatlas-theme") as "dark" | "light") || "dark",
  );
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");
  const [explorerWidth, setExplorerWidth] = useState(
    () => Number(localStorage.getItem("ca-explorer-width")) || 230,
  );
  const [inspectorWidth, setInspectorWidth] = useState(
    () => Number(localStorage.getItem("ca-inspector-width")) || 245,
  );
  const [analysisHeight, setAnalysisHeight] = useState(
    () => Number(localStorage.getItem("ca-analysis-height")) || 240,
  );
  const [explorerCollapsed, setExplorerCollapsed] = useState(
    () => localStorage.getItem("ca-explorer-collapsed") === "1",
  );
  const [inspectorCollapsed, setInspectorCollapsed] = useState(
    () => localStorage.getItem("ca-inspector-collapsed") === "1",
  );
  const [stateLabOpen, setStateLabOpen] = useState(false);
  const resizingRef = useRef<"explorer" | "inspector" | "analysis" | null>(
    null,
  );
  const layoutRootRef = useRef<HTMLElement>(null);

  const persistLayout = (key: string, value: number) =>
    localStorage.setItem(key, String(value));

  const startResize =
    (which: "explorer" | "inspector" | "analysis") =>
    (event: React.PointerEvent) => {
      event.preventDefault();
      resizingRef.current = which;
      const originX = event.clientX;
      const originY = event.clientY;
      const wasExplorerCollapsed = explorerCollapsed;
      const wasInspectorCollapsed = inspectorCollapsed;
      const startExplorer = explorerWidth;
      const startInspector = inspectorWidth;
      const startAnalysis = analysisHeight;
      const root = layoutRootRef.current;
      document.body.style.cursor =
        which === "analysis" ? "row-resize" : "col-resize";
      document.body.style.userSelect = "none";

      const onMove = (move: PointerEvent) => {
        if (which === "explorer") {
          const base = wasExplorerCollapsed ? 160 : startExplorer;
          const next = Math.min(
            560,
            Math.max(160, base + (move.clientX - originX)),
          );
          setExplorerWidth(next);
          persistLayout("ca-explorer-width", next);
        } else if (which === "inspector") {
          const base = wasInspectorCollapsed ? 160 : startInspector;
          const next = Math.min(
            560,
            Math.max(160, base - (move.clientX - originX)),
          );
          setInspectorWidth(next);
          persistLayout("ca-inspector-width", next);
        } else {
          const next = Math.min(
            Math.max(120, startAnalysis - (move.clientY - originY)),
            root ? root.clientHeight * 0.6 : 400,
          );
          setAnalysisHeight(next);
          persistLayout("ca-analysis-height", next);
        }
      };
      const onUp = () => {
        resizingRef.current = null;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        if (wasExplorerCollapsed) {
          localStorage.setItem("ca-explorer-collapsed", "0");
          setExplorerCollapsed(false);
        } else if (wasInspectorCollapsed) {
          localStorage.setItem("ca-inspector-collapsed", "0");
          setInspectorCollapsed(false);
        }
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    };

  const toggleExplorer = () => {
    setExplorerCollapsed((value) => {
      localStorage.setItem("ca-explorer-collapsed", value ? "0" : "1");
      return !value;
    });
  };
  const toggleInspector = () => {
    setInspectorCollapsed((value) => {
      localStorage.setItem("ca-inspector-collapsed", value ? "0" : "1");
      return !value;
    });
  };

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("codeatlas-theme", theme);
  }, [theme]);

  const toggleFolder = useCallback((nodeId: string) => {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  }, []);

  /**
   * Explorer sidebar click handler.
   * Selects the node AND pans / flashes it in the graph canvas.
   * Also opens the inspector if it is collapsed.
   */
  const handleSelect = useCallback(
    (node: ProjectNode) => {
      setSelected(node);
      graphRef.current?.focusNode(node.id);
      if (inspectorCollapsed) {
        localStorage.setItem("ca-inspector-collapsed", "0");
        setInspectorCollapsed(false);
      }
    },
    [inspectorCollapsed],
  );

  const parentById = useMemo(() => {
    const parents = new Map<string, string>();
    graph?.edges
      .filter((edge) => edge.relation !== "IMPORTS")
      .forEach((edge) => parents.set(edge.target, edge.source));
    return parents;
  }, [graph]);

  const moveNodes = useCallback(
    (movements: NodeMovement[]) => {
      if (!graph) return;
      const isDescendant = (candidateId: string, ancestorId: string) => {
        let parent = parentById.get(candidateId);
        while (parent) {
          if (parent === ancestorId) return true;
          parent = parentById.get(parent);
        }
        return false;
      };
      const roots = movements.filter(
        (movement) =>
          !movements.some(
            (other) =>
              other.id !== movement.id && isDescendant(movement.id, other.id),
          ),
      );
      setPositionOffsets((current) => {
        const next = new Map(current);
        graph.nodes.forEach((node) => {
          const movement = roots
            .filter(
              (root) => node.id === root.id || isDescendant(node.id, root.id),
            )
            .reduce(
              (total, root) => ({
                x: total.x + root.delta.x,
                y: total.y + root.delta.y,
              }),
              { x: 0, y: 0 },
            );
          if (!movement.x && !movement.y) return;
          const offset = next.get(node.id) ?? { x: 0, y: 0 };
          next.set(node.id, {
            x: offset.x + movement.x,
            y: offset.y + movement.y,
          });
        });
        return next;
      });
    },
    [graph, parentById],
  );

  const visibleGraph = useMemo(() => {
    if (!graph) return null;
    const parentById = new Map<string, string>();
    graph.edges
      .filter((edge) => edge.relation !== "IMPORTS")
      .forEach((edge) => parentById.set(edge.target, edge.source));
    const isVisible = (nodeId: string) => {
      let parent = parentById.get(nodeId);
      while (parent) {
        if (collapsed.has(parent)) return false;
        parent = parentById.get(parent);
      }
      return true;
    };
    const nodes = graph.nodes.filter((node) => isVisible(node.id));
    const nodeIds = new Set(nodes.map((node) => node.id));
    return {
      ...graph,
      nodes,
      edges: graph.edges.filter(
        (edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target),
      ),
    };
  }, [collapsed, graph]);

  const chooseFile = async (file?: File) => {
    if (!file) return;
    setError("");
    const uploadId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    setParsingUploadId(uploadId);
    setParsingFile(file);
  };

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    void chooseFile(event.target.files?.[0]);
    event.target.value = "";
  };

  const folderIds = useMemo(
    () =>
      graph?.nodes
        .filter((node) => node.type === "folder")
        .map((node) => node.id) ?? [],
    [graph],
  );
  const collapseAll = useCallback(
    () => setCollapsed(new Set(folderIds)),
    [folderIds],
  );
  const expandAll = useCallback(() => setCollapsed(new Set()), []);

  const gridCols = explorerCollapsed
    ? inspectorCollapsed
      ? "grid-cols-[0_0_minmax(0,1fr)_0_0]"
      : "grid-cols-[0_0_minmax(0,1fr)_4px_var(--inspector-width,245px)]"
    : inspectorCollapsed
      ? "grid-cols-[var(--explorer-width,230px)_4px_minmax(0,1fr)_0_0]"
      : "grid-cols-[var(--explorer-width,230px)_4px_minmax(0,1fr)_4px_var(--inspector-width,245px)]";
  const gridRows = analysisOpen
    ? "grid-rows-[minmax(0,1fr)_4px_auto]"
    : "grid-rows-[minmax(0,1fr)_0_0]";

  return (
    <main className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_72%_20%,#1a2424_0,transparent_32%),#101112] light:bg-[radial-gradient(circle_at_72%_20%,#dbeae5_0,transparent_34%),#eef1ed]">
      <header className="relative z-[2] flex h-[72px] items-center justify-between border-b border-[#2b3030] px-[42px] light:border-[#d6dfda] max-[850px]:px-[18px]">
        <div className="flex items-center gap-[11px] font-dm text-[14px] font-medium tracking-[.16em] light:text-[#202824]">
          <span className="text-[22px] text-[#f2b84b]">✦</span>
          <span>CODEATLAS</span>
          <small className="ml-3 text-[9px] tracking-[.1em] text-[#777e7d] light:text-[#71807a] max-[850px]:hidden">
            V1 / MILESTONE 1
          </small>
        </div>
        <div className="flex items-center gap-[27px] font-dm text-[11px]">
          <span className="text-[#7d8784] light:text-[#71807a] max-[850px]:hidden">
            <i className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-[#64d5c4] shadow-[0_0_12px_#64d5c4]" />{" "}
            API CONNECTED
          </span>
          <button
            className="border border-[#596260] bg-transparent px-3 py-[10px] font-dm text-[10px] tracking-[.05em] text-[#aeb8b3] transition-colors hover:border-[#f2b84b] hover:text-[#f2b84b] light:border-[#b8c8c0] light:text-[#405149] max-[850px]:hidden"
            onClick={() =>
              setTheme((value) => (value === "dark" ? "light" : "dark"))
            }
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          >
            {theme === "dark" ? "☼ LIGHT" : "◐ DARK"}
          </button>
          <button
            className="border border-[#596260] bg-transparent px-3 py-[10px] font-dm text-[10px] tracking-[.05em] text-[#aeb8b3] transition-colors hover:border-[#f2b84b] hover:text-[#f2b84b] light:border-[#b8c8c0] light:text-[#405149] max-[850px]:hidden"
            onClick={() => setStateLabOpen((value) => !value)}
          >
            STATE LAB
          </button>
          <button
            className="border border-[#596260] bg-transparent px-[14px] py-[10px] font-dm text-[11px] tracking-[.04em] text-[#eff0ed] transition-colors hover:border-[#f2b84b] hover:text-[#f2b84b] light:border-[#b8c8c0] light:text-[#202824]"
            onClick={() => inputRef.current?.click()}
          >
            + NEW PROJECT
          </button>
        </div>
      </header>

      {parsingFile ? (
        <ParsingScreen
          file={parsingFile}
          uploadId={parsingUploadId}
          onComplete={(nextGraph) => {
            setGraph(nextGraph);
            setProjectId(nextGraph.project_id ?? "");
            setCollapsed(new Set());
            setCompact(false);
            setPositionOffsets(new Map());
            setSelected(nextGraph.nodes[0] ?? null);
            setParsingFile(null);
            if (!nextGraph.files || nextGraph.files === 0) {
              toastEmpty("This archive contains no analyzable files.");
            }
          }}
          onError={(message) => {
            setError(message);
            setParsingFile(null);
          }}
          onCancel={() => {
            setParsingFile(null);
            setError("Upload cancelled.");
          }}
        />
      ) : !graph ? (
        <section className="relative mx-auto max-w-[850px] px-[30px] pb-20 pt-[126px] max-[850px]:pt-[90px]">
          <div className="mb-[25px] font-dm text-[11px] tracking-[.14em] text-[#64d5c4]">
            SOFTWARE ARCHITECTURE / 001
          </div>
          <h1 className="m-0 font-semibold leading-[.94] tracking-[-.07em] text-[clamp(50px,8vw,92px)] light:text-[#202824]">
            See the shape
            <br />
            <em className="text-[#f2b84b] not-italic">of your code.</em>
          </h1>
          <p className="my-[30px] mb-9 max-w-[410px] text-[15px] leading-[1.6] text-[#929a96] light:text-[#61716a]">
            Upload a project archive and turn its structure into a living map.
            Start with the files. Discover the system.
          </p>
          <button
            className="relative flex w-full max-w-[570px] min-h-[190px] flex-col items-center justify-center gap-[10px] border border-dashed border-[#626b66] bg-[rgba(27,33,32,.6)] text-[#eef0eb] transition-[background,border-color] duration-200 hover:border-[#64d5c4] hover:bg-[rgba(48,82,77,.22)] light:border-[#8ba49a] light:bg-[rgba(246,248,245,.86)] light:text-[#202824] light:hover:border-[#398f83] light:hover:bg-[#e3ece7]"
            onClick={() => inputRef.current?.click()}
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              void chooseFile(event.dataTransfer.files[0]);
            }}
          >
            <span className="text-[28px] text-[#f2b84b]">↑</span>
            <strong className="font-dm text-[14px] tracking-[.08em]">
              {dragging ? "DROP TO MAP" : "DROP YOUR ZIP HERE"}
            </strong>
            <span className="font-dm text-xs text-[#7e8985] light:text-[#61716a]">
              or <u>browse files</u> · max 200 MB
            </span>
          </button>
          {error && <p className="font-dm text-xs text-[#f28b78]">{error}</p>}
          <div className="mt-[38px] flex gap-[34px] font-dm text-[11px] text-[#65706c]">
            <span>
              <b className="mr-[7px] font-normal text-[#f2b84b]">01</b> Upload
              archive
            </span>
            <span>
              <b className="mr-[7px] font-normal text-[#f2b84b]">02</b> Scan
              structure
            </span>
            <span>
              <b className="mr-[7px] font-normal text-[#f2b84b]">03</b> Explore
              graph
            </span>
          </div>
          <div className="pointer-events-none absolute -right-[290px] top-[50px] h-[490px] w-[490px] rounded-full border border-[#253a37] light:border-[#cbded6]" />
          <div className="pointer-events-none absolute -right-[410px] -top-[70px] h-[730px] w-[730px] rounded-full border border-[#202e2c] light:border-[#cbded6]" />
        </section>
      ) : (
        <section
          ref={layoutRootRef}
          className={`relative grid h-[calc(100vh-72px)] gap-0 p-3 ${gridCols} ${gridRows} max-[850px]:block max-[850px]:h-auto max-[850px]:min-h-[calc(100vh-72px)]`}
          style={
            {
              "--explorer-width": explorerCollapsed
                ? "0px"
                : `${explorerWidth}px`,
              "--inspector-width": inspectorCollapsed
                ? "0px"
                : `${inspectorWidth}px`,
              "--analysis-height": `${analysisHeight}px`,
            } as CSSProperties
          }
        >
          {/* ── Left: Project Explorer ── */}
          <aside
            className={`${PANEL} relative overflow-hidden overflow-y-auto px-4 py-5 col-start-1 row-start-1 max-[850px]:order-2 max-[850px]:min-h-[220px]`}
          >
            <div className={PANEL_HEADING}>
              <span>PROJECT EXPLORER</span>
              <div className={PANEL_HEADING_ACTIONS}>
                <span className={MUTED}>{graph.files} FILES</span>
                <button
                  className={PANEL_COLLAPSE}
                  onClick={toggleExplorer}
                  aria-label={
                    explorerCollapsed ? "Expand explorer" : "Collapse explorer"
                  }
                >
                  <span className="material-symbols-outlined">
                    {explorerCollapsed ? "chevron_right" : "chevron_left"}
                  </span>
                </button>
              </div>
            </div>
            {!explorerCollapsed && (
              <>
                <div className="my-[30px] font-dm text-[13px] text-[#f2b84b]">
                  <span className="mr-[9px] inline-block h-2 w-2 bg-[#64d5c4]" />
                  {graph.project}
                </div>
                <input
                  className="w-full border border-[#303636] bg-[#111313] px-[10px] py-[9px] font-dm text-[11px] text-[#dfe5df] outline-none focus:border-[#64d5c4] light:border-[#ccd8d1] light:bg-[#edf2ee] light:text-[#202824]"
                  placeholder="Filter files..."
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
                <div className="mt-[15px] max-h-[calc(100vh-250px)] overflow-auto pr-0.5 max-[850px]:max-h-[180px]">
                  <ExplorerTree
                    graph={graph}
                    query={query}
                    selected={selected}
                    collapsed={collapsed}
                    onSelect={handleSelect}
                    onToggle={toggleFolder}
                  />
                </div>
                <div className="absolute bottom-[18px] flex gap-[11px] font-dm text-[9px] text-[#59635f] light:text-[#687870] max-[850px]:hidden">
                  <span>
                    <i
                      className="mr-1 inline-block h-1.5 w-1.5 rounded-full"
                      style={{ background: colors.file }}
                    />{" "}
                    FILE
                  </span>
                  <span>
                    <i
                      className="mr-1 inline-block h-1.5 w-1.5 rounded-full"
                      style={{ background: colors.folder }}
                    />{" "}
                    FOLDER
                  </span>
                </div>
              </>
            )}
          </aside>
          {explorerCollapsed && (
            <button
              className="absolute inset-y-0 left-0 z-[6] flex w-[18px] items-center justify-center border-0 border-r border-[#2b3030] bg-[#171a1ad9] text-[#79817e] transition-[background,color] duration-150 hover:bg-[#242d2b] hover:text-[#f2b84b] [&_.material-symbols-outlined]:text-[16px]"
              title="Open explorer (click or drag)"
              onPointerDown={startResize("explorer")}
            >
              <span className="material-symbols-outlined">chevron_right</span>
            </button>
          )}
          <div
            className={`relative z-[5] col-start-2 row-start-1 cursor-col-resize before:absolute before:inset-y-0 before:left-px before:right-px before:bg-transparent before:transition-colors before:duration-150 hover:before:bg-[#2f3a37] light:hover:before:bg-[#b8c8c0] ${resizingRef.current === "explorer" ? "bg-[#3d4b47] light:bg-[#b8c8c0]" : ""} max-[850px]:hidden`}
            onPointerDown={startResize("explorer")}
          />

          {/* ── Centre: Graph Canvas ── */}
          <div
            className={`${PANEL} relative col-start-3 row-start-1 flex flex-col overflow-hidden max-[850px]:min-h-[600px]`}
          >
            <div className="flex h-[49px] items-center justify-between border-b border-[#2b3030] px-5 font-dm text-[10px] tracking-[.1em] text-[#79817e] light:border-[#d6dfda]">
              <div className="text-[#b1bab5] light:text-[#202824]">
                <span className={LIVE_DOT} /> STRUCTURE MAP{" "}
                <span className="mx-[7px] text-[#46504d]">/</span>{" "}
                {visibleGraph?.nodes.length ?? 0} OF {graph.nodes.length} NODES
              </div>
              <div className="flex items-center gap-[5px]">
                <button
                  className={`border border-[var(--graph-edge)] bg-[var(--graph-surface)] px-2 py-[6px] font-dm text-[9px] tracking-[.02em] text-[var(--graph-label)] transition-colors hover:border-[#f2b84b] hover:text-[#f2b84b] light:border-[#b8c8c0] light:bg-[#f6f8f5] light:text-[#405149] light:hover:bg-[#e3ece7] ${analysisOpen ? "border-[#f2b84b] text-[#f2b84b] light:bg-[#e3ece7]" : ""}`}
                  onClick={() => setAnalysisOpen((value) => !value)}
                >
                  {analysisOpen ? "HIDE ANALYSIS" : "ANALYSIS"}
                </button>
                <button
                  className={`border border-[var(--graph-edge)] bg-[var(--graph-surface)] px-2 py-[6px] font-dm text-[9px] tracking-[.02em] text-[var(--graph-label)] transition-colors hover:border-[#f2b84b] hover:text-[#f2b84b] light:border-[#b8c8c0] light:bg-[#f6f8f5] light:text-[#405149] light:hover:bg-[#e3ece7] ${compact ? "border-[#f2b84b] text-[#f2b84b] light:bg-[#e3ece7]" : ""}`}
                  onClick={() => {
                    setCompact((value) => !value);
                    toastProcessing(
                      `Re-laying out ${graph.nodes.length} nodes…`,
                    );
                  }}
                >
                  {compact ? "RELAX" : "TIGHTEN"}
                </button>
                <button
                  className="border border-[var(--graph-edge)] bg-[var(--graph-surface)] px-2 py-[6px] font-dm text-[9px] tracking-[.02em] text-[var(--graph-label)] transition-colors hover:border-[#f2b84b] hover:text-[#f2b84b] light:border-[#b8c8c0] light:bg-[#f6f8f5] light:text-[#405149] light:hover:bg-[#e3ece7]"
                  onClick={() => {
                    collapseAll();
                    toastProcessing("Collapsing folder tree…");
                  }}
                >
                  COLLAPSE ALL
                </button>
                <button
                  className="border border-[var(--graph-edge)] bg-[var(--graph-surface)] px-2 py-[6px] font-dm text-[9px] tracking-[.02em] text-[var(--graph-label)] transition-colors hover:border-[#f2b84b] hover:text-[#f2b84b] light:border-[#b8c8c0] light:bg-[#f6f8f5] light:text-[#405149] light:hover:bg-[#e3ece7]"
                  onClick={() => {
                    expandAll();
                    toastProcessing("Expanding folder tree…");
                  }}
                >
                  EXPAND ALL
                </button>
              </div>
            </div>
            <ReactFlowProvider>
              <GraphCanvas
                ref={graphRef}
                graph={graph}
                collapsed={collapsed}
                selected={selected}
                onSelect={handleSelect}
                onToggle={toggleFolder}
                compact={compact}
                positionOffsets={positionOffsets}
                onMoveNodes={moveNodes}
              />
            </ReactFlowProvider>
          </div>

          <div
            className={`relative z-[5] col-start-4 row-start-1 cursor-col-resize before:absolute before:inset-y-0 before:left-px before:right-px before:bg-transparent before:transition-colors before:duration-150 hover:before:bg-[#2f3a37] light:hover:before:bg-[#b8c8c0] ${resizingRef.current === "inspector" ? "bg-[#3d4b47] light:bg-[#b8c8c0]" : ""} max-[850px]:hidden`}
            onPointerDown={startResize("inspector")}
          />

          {/* ── Right: Inspector ── */}
          <aside
            className={`${PANEL} relative overflow-hidden px-4 py-5 col-start-5 row-start-1 max-[850px]:order-3 max-[850px]:min-h-[300px]`}
          >
            <div className={PANEL_HEADING}>
              <span>INSPECTOR</span>
              <div className={PANEL_HEADING_ACTIONS}>
                <span className={MUTED}>
                  {selected ? selected.type.toUpperCase() : "NONE"}
                </span>
                <button
                  className={PANEL_COLLAPSE}
                  onClick={toggleInspector}
                  aria-label={
                    inspectorCollapsed
                      ? "Expand inspector"
                      : "Collapse inspector"
                  }
                >
                  <span className="material-symbols-outlined">
                    {inspectorCollapsed ? "chevron_left" : "chevron_right"}
                  </span>
                </button>
              </div>
            </div>
            {!inspectorCollapsed && (
              <>
                {selected ? (
                  <>
                    <div className="mx-[-16px] grid grid-cols-3 border-y border-[#2b3030] light:border-[#d6dfda]" style={{ marginTop: 23, marginBottom: 25 }}>
                      <div className="border-r border-[#2b3030] px-[3px] py-3 text-center light:border-[#d6dfda]">
                        <strong>{graph.files}</strong>
                        <span>FILES</span>
                      </div>
                      <div className="border-r border-[#2b3030] px-[3px] py-3 text-center light:border-[#d6dfda]">
                        <strong>{graph.folders}</strong>
                        <span>FOLDERS</span>
                      </div>
                      <div className="px-[3px] py-3 text-center">
                        <strong>{Object.keys(graph.languages).length}</strong>
                        <span>LANGUAGES</span>
                      </div>
                    </div>
                    <div
                      className="mt-3 text-[45px]"
                      style={{ color: colors[selected.type] }}
                    >
                      <span className="material-symbols-outlined">
                        {selected.type === "file"
                          ? fileIcon(selected.label).name
                          : selected.type === "folder"
                            ? "folder"
                            : "account_tree"}
                      </span>
                    </div>
                    <h2 className="my-[5px] text-[20px] [overflow-wrap:anywhere]">
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
                    {/* Function call intelligence panel */}
                    {selected.type === "file" &&
                      graph.function_calls &&
                      graph.function_calls.length > 0 && (
                        <FunctionCallsPanel
                          filePath={selected.path}
                          functionCalls={graph.function_calls}
                        />
                      )}
                    {/* Image / PDF preview */}
                    {projectId && isPreviewable(selected) && (
                      <FilePreview node={selected} projectId={projectId} />
                    )}
                  </>
                ) : (
                  <p className="mt-[50px] font-dm text-xs leading-[1.6] text-[#6f7975] light:text-[#61716a]">
                    Select a node in the map to see its details.
                  </p>
                )}
              </>
            )}
          </aside>
          {inspectorCollapsed && (
            <button
              className="absolute inset-y-0 right-0 z-[6] flex w-[18px] items-center justify-center border-0 border-l border-[#2b3030] bg-[#171a1ad9] text-[#79817e] transition-[background,color] duration-150 hover:bg-[#242d2b] hover:text-[#f2b84b] [&_.material-symbols-outlined]:text-[16px]"
              title="Open inspector (click or drag)"
              onPointerDown={startResize("inspector")}
            >
              <span className="material-symbols-outlined">chevron_left</span>
            </button>
          )}
          <div
            className={`relative z-[5] col-start-3 row-start-2 cursor-row-resize before:absolute before:inset-x-0 before:top-px before:bottom-px before:bg-transparent before:transition-colors before:duration-150 hover:before:bg-[#2f3a37] light:hover:before:bg-[#b8c8c0] ${resizingRef.current === "analysis" ? "bg-[#3d4b47] light:bg-[#b8c8c0]" : ""} ${analysisOpen ? "" : "hidden"} max-[850px]:hidden`}
            onPointerDown={startResize("analysis")}
          />
          <div
            className={`${PANEL} flex h-[var(--analysis-height,240px)] min-h-0 flex-col overflow-hidden col-start-3 row-start-3 ${analysisOpen ? "" : "hidden"}`}
          >
            <div className="flex h-9 flex-none items-center justify-between border-b border-[#2b3030] pl-5 pr-[14px] font-dm text-[10px] tracking-[.1em] text-[#b1bab5] light:border-[#d6dfda] light:text-[#71807a]">
              <div>
                <span className={LIVE_DOT} /> ARCHITECTURE ANALYSIS
              </div>
              <button
                className={PANEL_COLLAPSE}
                onClick={() => setAnalysisOpen(false)}
                aria-label="Close analysis panel"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <AnalysisDrawer analysis={graph.analysis} />
            </div>
          </div>
        </section>
      )}
      <input
        ref={inputRef}
        type="file"
        accept=".zip,application/zip"
        hidden
        onChange={onFileChange}
      />
      {stateLabOpen && <StateLab onClose={() => setStateLabOpen(false)} />}
    </main>
  );
}

export default Home;
