import { useEffect, useMemo, useState } from "react";
import { Pause, Play, RotateCcw, Sparkles } from "lucide-react";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useNodesState,
} from "@xyflow/react";
import type { Edge } from "@xyflow/react";
import { AtlasNodeView } from "../atlas/atlas-node";
import type { AtlasNode } from "../atlas/atlas-types";
import type { ProjectNode } from "../../types/project";

const phases = [
  { label: "Uploading repository", detail: "atlas-demo.zip", progress: 14 },
  {
    label: "Detecting languages",
    detail: "TypeScript · Python · Dart · SQL",
    progress: 34,
  },
  {
    label: "Resolving imports",
    detail: "1,248 relationships mapped",
    progress: 56,
  },
  {
    label: "Tracing API calls",
    detail: "REST · GraphQL · Firebase",
    progress: 76,
  },
  {
    label: "Architecture ready",
    detail: "Interactive map generated",
    progress: 100,
  },
];

const nodeTypes = { atlas: AtlasNodeView };

const sampleNodes: ProjectNode[] = [
  { id: "demo-root", label: "atlas-demo", path: "", type: "project" },
  { id: "demo-ui", label: "src", path: "src", type: "folder" },
  {
    id: "demo-login",
    label: "Login.tsx",
    path: "src/Login.tsx",
    type: "file",
    language: "TypeScript",
  },
  { id: "demo-api", label: "api", path: "src/api", type: "folder" },
  {
    id: "demo-client",
    label: "client.ts",
    path: "src/api/client.ts",
    type: "file",
    language: "TypeScript",
  },
  {
    id: "demo-auth",
    label: "auth.py",
    path: "services/auth.py",
    type: "file",
    language: "Python",
  },
  {
    id: "demo-db",
    label: "database",
    path: "data/database.sql",
    type: "file",
    language: "SQL",
  },
];

const sampleEdges: Edge[] = [
  {
    id: "demo-contains-ui",
    source: "demo-root",
    target: "demo-ui",
    type: "smoothstep",
    style: { stroke: "var(--graph-edge)" },
  },
  {
    id: "demo-contains-api",
    source: "demo-root",
    target: "demo-api",
    type: "smoothstep",
    style: { stroke: "var(--graph-edge)" },
  },
  {
    id: "demo-contains-login",
    source: "demo-ui",
    target: "demo-login",
    type: "smoothstep",
    style: { stroke: "var(--graph-edge)" },
  },
  {
    id: "demo-contains-client",
    source: "demo-api",
    target: "demo-client",
    type: "smoothstep",
    style: { stroke: "var(--graph-edge)" },
  },
  {
    id: "demo-import-login",
    source: "demo-login",
    target: "demo-client",
    type: "bezier",
    animated: true,
    label: "API",
    style: {
      stroke: "var(--import-edge)",
      strokeWidth: 1.8,
      strokeDasharray: "5 4",
    },
  },
  {
    id: "demo-import-client",
    source: "demo-client",
    target: "demo-auth",
    type: "bezier",
    animated: true,
    label: "HTTP",
    style: {
      stroke: "var(--import-edge)",
      strokeWidth: 1.8,
      strokeDasharray: "5 4",
    },
  },
  {
    id: "demo-import-auth",
    source: "demo-auth",
    target: "demo-db",
    type: "bezier",
    animated: true,
    label: "SQL",
    style: {
      stroke: "var(--import-edge)",
      strokeWidth: 1.8,
      strokeDasharray: "5 4",
    },
  },
];

function LandingGraph() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const initialNodes: AtlasNode[] = useMemo(
    () =>
      sampleNodes.map((node, index) => ({
        id: node.id,
        type: "atlas" as const,
        position: [
          { x: 300, y: 20 },
          { x: 80, y: 145 },
          { x: 20, y: 275 },
          { x: 330, y: 145 },
          { x: 280, y: 275 },
          { x: 500, y: 190 },
          { x: 500, y: 300 },
        ][index],
        data: {
          ...node,
          selected: node.id === selectedId,
          focused: false,
          onSelect: () => setSelectedId(node.id),
          onToggle: () => undefined,
        },
      })),
    [],
  );
  const [nodes, setNodes, onNodesChange] = useNodesState<AtlasNode>(initialNodes);
  useEffect(() => {
    setNodes((current) => current.map((node) => ({
      ...node,
      data: { ...node.data, selected: node.id === selectedId },
    })));
  }, [selectedId, setNodes]);
  return (
    <ReactFlowProvider>
      <div className="landing-react-flow h-[390px] w-full ">
        <ReactFlow
          nodes={nodes}
          edges={sampleEdges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onNodeClick={(_, node) => setSelectedId(node.id)}
          fitView
          fitViewOptions={{ padding: 0.18}}
          nodesDraggable
          nodesConnectable={false}
          panOnDrag={[1, 2]}
          onlyRenderVisibleElements
          proOptions={{ hideAttribution: true }}
        >
          <Background color="var(--graph-grid)" gap={26} size={2.5} />
          <MiniMap  pannable zoomable nodeColor={(node) => node.type === "atlas" ? "var(--node-file)" : "var(--node-project)"}  maskColor="var(--minimap-mask)" className="landing-minimap" />
          <Controls position="bottom-left" />
        </ReactFlow>
      </div>
    </ReactFlowProvider>
  );
}

export default function DemoWorkflow({ onTryIt }: { onTryIt: () => void }) {
  const [phase, setPhase] = useState(0);
  const [running, setRunning] = useState(true);

  useEffect(() => {
    if (!running || phase >= phases.length - 1) return;
    const timer = window.setInterval(
      () => setPhase((current) => Math.min(current + 1, phases.length - 1)),
      1700,
    );
    return () => window.clearInterval(timer);
  }, [phase, running]);

  const current = phases[phase];
  return (
    <div className="landing-demo-panel rounded-[22px] border border-[var(--ca-hairline)] bg-[var(--ca-surface-card)] p-8 shadow-[0_30px_90px_rgba(38,37,30,.12)]">
      <div className="flex items-center justify-between border-b border-[var(--ca-hairline)] pb-3">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 animate-pulse rounded-full bg-[var(--ca-success)]" />
          <span className="ca-mono-label !text-[10px]">LIVE WORKFLOW DEMO</span>
        </div>
        <span className="ca-mono-label !text-[10px] text-[var(--ca-muted)]">
          {current.progress}% complete
        </span>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-[1.15fr_.85fr]">
        <div className="relative min-h-[300px] overflow-hidden rounded-xl border border-[var(--ca-hairline)] bg-[var(--ca-canvas-soft)] p-3">
          <div className="absolute inset-0 bg-[radial-gradient(var(--ca-hairline-strong)_1px,transparent_1px)] bg-[size:22px_22px] opacity-40" />
          <LandingGraph />
        </div>
        <div className="flex flex-col rounded-xl border border-[var(--ca-hairline)] bg-[var(--ca-canvas-soft)] p-6">
          <div className="flex items-start gap-3">
            <Sparkles size={16} className="mt-0.5 text-[var(--ca-primary)]" />
            <div>
              <p className="m-0 text-sm font-medium text-[var(--ca-ink)]">
                {current.label}
              </p>
              <p className="mt-1 mb-0 ca-mono-label !text-[10px]">
                {current.detail}
              </p>
            </div>
          </div>
          <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-[var(--ca-surface-strong)]">
            <div
              className="h-full rounded-full bg-[var(--ca-primary)] transition-[width] duration-700"
              style={{ width: `${current.progress}%` }}
            />
          </div>
          <div className="mt-5 flex flex-1 flex-col gap-2">
            {phases.map((item, index) => (
              <div
                key={item.label}
                className={`flex items-center gap-2 rounded-lg px-2 py-2 ${index === phase ? "bg-[color-mix(in_srgb,var(--ca-primary)_10%,transparent)]" : ""}`}
              >
                <span
                  className={`grid h-5 w-5 place-items-center rounded-full border text-[9px] ${index <= phase ? "border-[var(--ca-success)] text-[var(--ca-success)]" : "border-[var(--ca-hairline-strong)] text-[var(--ca-muted)]"}`}
                >
                  {index < phase ? "✓" : index + 1}
                </span>
                <span className="ca-mono-label !text-[10px]">{item.label}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 flex gap-2">
            <button
              className="ca-btn-secondary h-9 flex-1 !px-3 !text-[11px]"
              onClick={() => setRunning((value) => !value)}
            >
              {running ? <Pause size={13} /> : <Play size={13} />}
              {running ? "Pause" : "Resume"}
            </button>
            <button
              className="ca-btn-secondary h-9 !px-3 !text-[11px]"
              onClick={() => {
                setPhase(0);
                setRunning(true);
              }}
              aria-label="Restart demo"
            >
              <RotateCcw size={13} />
            </button>
            <button
              className="ca-btn-primary h-9 flex-1 !px-3 !text-[11px]"
              onClick={onTryIt}
            >
              Try your repo
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
