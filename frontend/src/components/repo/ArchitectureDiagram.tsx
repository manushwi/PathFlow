"use client";
import { useMemo } from "react";
import dynamic from "next/dynamic";
import { MarkerType } from "reactflow";

const ReactFlow = dynamic(() => import("reactflow").then((m) => m.default), { ssr: false });
const MiniMap = dynamic(() => import("reactflow").then((m) => m.MiniMap), { ssr: false });
const Controls = dynamic(() => import("reactflow").then((m) => m.Controls), { ssr: false });
const Background = dynamic(() => import("reactflow").then((m) => m.Background), { ssr: false });

import "reactflow/dist/style.css";

interface ArchitectureDiagramProps {
  graph: { nodes: any[]; edges: any[] } | null;
}

export function ArchitectureDiagram({ graph }: ArchitectureDiagramProps) {
  if (!graph || !graph.nodes || graph.nodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 rounded-lg" style={{ background: "var(--card)" }}>
        <p style={{ color: "var(--muted-foreground)" }}>Architecture diagram not available yet</p>
      </div>
    );
  }

  const defaultEdgeOptions = useMemo(() => ({
    style: { stroke: "#6366f1", strokeWidth: 2 },
    markerEnd: { type: MarkerType.ArrowClosed, color: "#6366f1" },
  }), []);

  return (
    <div className="h-[400px] rounded-lg overflow-hidden" style={{ background: "#0d0d14" }}>
      <ReactFlow
        nodes={graph.nodes}
        edges={graph.edges}
        defaultEdgeOptions={defaultEdgeOptions}
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
  );
}
