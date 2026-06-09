"use client";
import { useState } from "react";
import { ChevronRight, ChevronDown, File, Folder, FolderOpen } from "lucide-react";

interface FileTreeProps {
  tree: Record<string, any>;
  onFileSelect: (path: string) => void;
  activeFile?: string;
}

function FileTreeNode({ name, node, path, onFileSelect, activeFile, depth = 0 }: {
  name: string;
  node: any;
  path: string;
  onFileSelect: (path: string) => void;
  activeFile?: string;
  depth?: number;
}) {
  const [open, setOpen] = useState(depth < 1);
  const isDir = node && !node.type;
  const fullPath = path ? `${path}/${name}` : name;

  if (isDir) {
    const entries = Object.entries(node);
    return (
      <div>
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-1 w-full px-2 py-1 text-left text-sm hover:opacity-80"
          style={{ color: "var(--foreground)", paddingLeft: `${depth * 16 + 8}px` }}
        >
          {open ? <ChevronDown className="w-3.5 h-3.5 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 shrink-0" />}
          {open ? <FolderOpen className="w-4 h-4 shrink-0" style={{ color: "var(--accent)" }} /> : <Folder className="w-4 h-4 shrink-0" style={{ color: "var(--accent)" }} />}
          <span className="truncate">{name}</span>
        </button>
        {open && entries.map(([childName, childNode]) => (
          <FileTreeNode
            key={childName}
            name={childName}
            node={childNode}
            path={fullPath}
            onFileSelect={onFileSelect}
            activeFile={activeFile}
            depth={depth + 1}
          />
        ))}
      </div>
    );
  }

  const isActive = fullPath === activeFile;
  return (
    <button
      onClick={() => onFileSelect(fullPath)}
      className="flex items-center gap-1 w-full px-2 py-1 text-sm"
      style={{
        color: isActive ? "var(--accent)" : "var(--foreground)",
        background: isActive ? "var(--accent)15" : "transparent",
        paddingLeft: `${depth * 16 + 24}px`,
      }}
    >
      <File className="w-4 h-4 shrink-0" style={{ color: "var(--muted-foreground)" }} />
      <span className="truncate">{name}</span>
    </button>
  );
}

export function FileTree({ tree, onFileSelect, activeFile }: FileTreeProps) {
  return (
    <div className="overflow-auto h-full" style={{ background: "var(--sidebar)" }}>
      {Object.entries(tree).map(([name, node]) => (
        <FileTreeNode
          key={name}
          name={name}
          node={node}
          path=""
          onFileSelect={onFileSelect}
          activeFile={activeFile}
        />
      ))}
      {Object.keys(tree).length === 0 && (
        <p className="text-xs text-center py-8" style={{ color: "var(--muted-foreground)" }}>
          No files loaded
        </p>
      )}
    </div>
  );
}
