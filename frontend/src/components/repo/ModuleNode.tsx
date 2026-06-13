"use client";
import { memo } from "react";
import { Handle, Position, type NodeProps } from "reactflow";
import {
  FolderTree, Database, Shield, Code2, Box, Globe, Cpu, FileCode,
} from "lucide-react";

const moduleIcons: Record<string, any> = {
  auth: Shield,
  db: Database,
  database: Database,
  api: Globe,
  server: Cpu,
  frontend: Globe,
  web: Globe,
  ui: Code2,
  utils: Box,
  config: Box,
  lib: Box,
  core: Cpu,
  middleware: Code2,
};

function ModuleNode({ data }: NodeProps) {
  const Icon = moduleIcons[(data.label as string)?.toLowerCase()] || FolderTree;
  return (
    <div className="rounded-xl bg-[#1e1e2e] border border-[#6366f1]/50 p-3 min-w-[180px] cursor-pointer hover:border-[#6366f1] transition-colors shadow-lg">
      <Handle type="target" position={Position.Top} className="!bg-[#6366f1]" />
      <div className="flex items-center gap-2 mb-1">
        <Icon className="w-4 h-4 text-[#6366f1]" />
        <span className="font-semibold text-sm text-[#e2e8f0]">{data.label as string}</span>
      </div>
      {data.purpose && (
        <p className="text-xs text-[#94a3b8] line-clamp-2">{data.purpose as string}</p>
      )}
      {(data.files as number) > 0 && (
        <div className="flex items-center gap-1 mt-1">
          <FileCode className="w-3 h-3 text-[#64748b]" />
          <span className="text-xs text-[#64748b]">{data.files as number} files</span>
        </div>
      )}
      <Handle type="source" position={Position.Bottom} className="!bg-[#6366f1]" />
    </div>
  );
}

export default memo(ModuleNode);
