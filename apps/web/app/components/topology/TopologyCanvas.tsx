import { useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  type NodeProps,
} from "@xyflow/react";
import type {
  TopologyGraph,
  TopologyNode,
  ServerNodeData,
  ContainerNodeData,
  ProjectNodeData,
  EnvironmentNodeData,
  ClientNodeData,
} from "@inframonitor/shared-types";
import { cn } from "~/lib/cn";

// ---- Nodos custom ----

const STATUS_DOT: Record<string, string> = {
  running: "bg-status-running",
  stopped: "bg-status-stopped",
  provisioning: "bg-status-provisioning",
  error: "bg-status-error",
  terminated: "bg-slate-400",
};

function ServerNode({ data }: NodeProps<Node<{ topo: TopologyNode }>>) {
  const t = data.topo;
  const d = t.data as unknown as ServerNodeData;
  return (
    <div className="rounded-lg border border-slate-300 bg-white shadow-sm w-56">
      <div className="px-3 py-2 border-b border-slate-200 flex items-center gap-2">
        <span className={cn("size-2 rounded-full", STATUS_DOT[d.status] ?? "bg-slate-400")} />
        <span className="font-medium text-sm truncate flex-1">{t.label}</span>
        <span className="text-[10px] uppercase text-slate-500">{d.provider}</span>
      </div>
      <div className="px-3 py-2 text-xs text-slate-700 space-y-0.5">
        <div className="flex justify-between"><span>Región</span><span>{d.region}</span></div>
        {d.publicIp ? <div className="flex justify-between"><span>IP pub.</span><span className="font-mono">{d.publicIp}</span></div> : null}
        {d.os ? <div className="flex justify-between"><span>OS</span><span>{d.os}</span></div> : null}
        <div className="flex justify-between"><span>Containers</span><span>{d.containerCount}</span></div>
        {typeof d.costMonthlyUsd === "number" ? (
          <div className="flex justify-between text-slate-500"><span>Costo/mes</span><span>${d.costMonthlyUsd}</span></div>
        ) : null}
      </div>
    </div>
  );
}

function ContainerNode({ data }: NodeProps<Node<{ topo: TopologyNode }>>) {
  const t = data.topo;
  const d = t.data as unknown as ContainerNodeData;
  return (
    <div className="rounded-md border border-slate-300 bg-slate-50 shadow-sm w-48 px-3 py-2">
      <div className="flex items-center gap-2 mb-1">
        <span className={cn("size-2 rounded-full", STATUS_DOT[d.state] ?? "bg-slate-400")} />
        <span className="font-medium text-sm truncate">{t.label}</span>
      </div>
      <div className="text-[11px] font-mono text-slate-600 truncate">{d.image}</div>
      {d.ports && d.ports.length > 0 ? (
        <div className="text-[11px] text-slate-500 mt-1">
          {d.ports.map((p, i) => (
            <span key={i} className="mr-1.5">
              :{p.host ?? p.container}→{p.container}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ProjectNode({ data }: NodeProps<Node<{ topo: TopologyNode }>>) {
  const t = data.topo;
  const d = t.data as unknown as ProjectNodeData;
  return (
    <div
      className="rounded-lg border-2 bg-white shadow-sm w-52 px-3 py-2"
      style={{ borderColor: d.colorHex ?? "#6366f1" }}
    >
      <div className="text-[10px] uppercase text-slate-500">Proyecto</div>
      <div className="font-semibold text-sm">{t.label}</div>
      <div className="text-xs text-slate-500 font-mono">/{d.slug}</div>
    </div>
  );
}

function EnvironmentNode({ data }: NodeProps<Node<{ topo: TopologyNode }>>) {
  const t = data.topo;
  const d = t.data as unknown as EnvironmentNodeData;
  return (
    <div className="rounded-md border border-amber-300 bg-amber-50 shadow-sm w-44 px-3 py-2">
      <div className="text-[10px] uppercase text-amber-700">Ambiente</div>
      <div className="font-semibold text-sm uppercase">{d.name}</div>
      {d.urlBase ? <div className="text-xs text-amber-800 truncate">{d.urlBase}</div> : null}
    </div>
  );
}

function ClientNode({ data }: NodeProps<Node<{ topo: TopologyNode }>>) {
  const t = data.topo;
  const d = t.data as unknown as ClientNodeData;
  return (
    <div
      className="rounded-lg border-2 bg-white shadow-sm w-52 px-3 py-2"
      style={{ borderColor: d.colorHex ?? "#10b981" }}
    >
      <div className="text-[10px] uppercase text-slate-500">{d.type}</div>
      <div className="font-semibold text-sm">{t.label}</div>
      <div className="text-xs text-slate-500">{d.serverCount} servidor{d.serverCount === 1 ? "" : "es"}</div>
    </div>
  );
}

const nodeTypes = {
  server: ServerNode,
  container: ContainerNode,
  project: ProjectNode,
  environment: EnvironmentNode,
  client: ClientNode,
};

// ---- Canvas principal ----

export function TopologyCanvas({ graph }: { graph: TopologyGraph }) {
  const { nodes, edges } = useMemo(() => {
    const nodes: Node[] = graph.nodes.map((n) => ({
      id: n.id,
      type: nodeTypes[n.kind as keyof typeof nodeTypes] ? n.kind : "default",
      data: { topo: n },
      position: n.position ?? { x: 0, y: 0 },
      draggable: true,
    }));
    const edges: Edge[] = graph.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      label: e.label,
      type: "smoothstep",
      animated: e.kind === "uses",
    }));
    return { nodes, edges };
  }, [graph]);

  return (
    <div className="w-full h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={16} />
        <Controls />
        <MiniMap
          pannable
          zoomable
          nodeColor={(n) => {
            const topo = (n.data as { topo?: TopologyNode })?.topo;
            switch (topo?.kind) {
              case "server":
                return "#6366f1";
              case "container":
                return "#94a3b8";
              case "project":
                return "#a78bfa";
              case "environment":
                return "#f59e0b";
              case "client":
                return "#10b981";
              default:
                return "#cbd5e1";
            }
          }}
        />
      </ReactFlow>
    </div>
  );
}
