"use client";
import { useMemo, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { MarkerType } from "reactflow";
import dagre from "dagre";
import ModuleNode from "./ModuleNode";
import { ModuleDetailPanel } from "./ModuleDetailPanel";
import { WorkflowTimeline } from "./WorkflowTimeline";

const ReactFlow = dynamic(() => import("reactflow").then((m) => m.default), { ssr: false });
const MiniMap = dynamic(() => import("reactflow").then((m) => m.MiniMap), { ssr: false });
const Controls = dynamic(() => import("reactflow").then((m) => m.Controls), { ssr: false });
const Background = dynamic(() => import("reactflow").then((m) => m.Background), { ssr: false });

import "reactflow/dist/style.css";

interface KeyFile {
  path: string;
  role: string;
}

interface WorkflowStep {
  step: string;
  file: string;
}

interface Workflow {
  name: string;
  description: string;
  steps: WorkflowStep[];
}

interface ArchitectureDiagramProps {
  graph: { nodes: any[]; edges: any[] } | null;
  docs?: {
    modules?: { name: string; path: string; purpose: string; key_files: KeyFile[]; depends_on: string[] }[];
    workflows?: Workflow[];
  } | null;
  onFileSelect?: (path: string) => void;
}

const nodeTypes = { module: ModuleNode };

const NODE_WIDTH = 320;
const NODE_HEIGHT = 130;

function getLayoutedElements(nodes: any[], edges: any[], direction = "LR") {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: direction, nodesep: 60, ranksep: 100 });

  nodes.forEach((n) => g.setNode(n.id, { width: NODE_WIDTH, height: NODE_HEIGHT }));
  edges.forEach((e) => g.setEdge(e.source, e.target));

  dagre.layout(g);

  return {
    nodes: nodes.map((n) => {
      const { x, y } = g.node(n.id);
      return { ...n, position: { x: x - NODE_WIDTH / 2, y: y - NODE_HEIGHT / 2 } };
    }),
    edges,
  };
}

export function ArchitectureDiagram({ graph, docs, onFileSelect }: ArchitectureDiagramProps) {
  const [selectedModule, setSelectedModule] = useState<any>(null);

  const { nodes: layoutedNodes, edges: layoutedEdges } = useMemo(() => {
    if (!graph?.nodes?.length) return { nodes: [], edges: [] };
    return getLayoutedElements(graph.nodes, graph.edges || []);
  }, [graph]);

  const onNodeClick = useCallback((_event: any, node: any) => {
    if (node.data?.is_tech_node) return;
    const mod = docs?.modules?.find((m) => m.name === node.data?.label);
    if (mod) {
      setSelectedModule({
        label: mod.name,
        path: mod.path,
        purpose: mod.purpose,
        key_files: mod.key_files || [],
        files: mod.key_files?.length || 0,
      });
    } else {
      setSelectedModule({
        label: node.data?.label || "",
        path: node.data?.path || "",
        purpose: node.data?.purpose || "",
        key_files: node.data?.key_files || [],
        files: node.data?.files || 0,
      });
    }
  }, [docs]);

  const defaultEdgeOptions = useMemo(() => ({
    style: { stroke: "#6366f1", strokeWidth: 2 },
    markerEnd: { type: MarkerType.ArrowClosed, color: "#6366f1" },
  }), []);

  if (!graph || !graph.nodes || graph.nodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 rounded-lg" style={{ background: "var(--card)" }}>
        <p style={{ color: "var(--muted-foreground)" }}>Architecture diagram not available yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="h-[400px] rounded-lg overflow-hidden" style={{ background: "#0d0d14" }}>
        <ReactFlow
          nodes={layoutedNodes}
          edges={layoutedEdges}
          defaultEdgeOptions={defaultEdgeOptions}
          nodeTypes={nodeTypes}
          onNodeClick={onNodeClick}
          fitView
          attributionPosition="bottom-left"
        >
          <MiniMap
            style={{ background: "#1a1a2e" }}
            nodeColor="#6366f1"
            maskColor="rgba(0,0,0,0.6)"
          />
          <Controls />
          <Background color="#2a2a45" gap={20} />
        </ReactFlow>
      </div>

      {docs?.workflows && docs.workflows.length > 0 && (
        <WorkflowTimeline workflows={docs.workflows} onFileSelect={onFileSelect} />
      )}

      <ModuleDetailPanel
        module={selectedModule}
        workflows={docs?.workflows || []}
        onClose={() => setSelectedModule(null)}
        onFileSelect={onFileSelect}
      />
    </div>
  );
}
