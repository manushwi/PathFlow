"use client";
import { useState, useRef, useEffect } from "react";
import { ChevronRight, ChevronDown, File, Folder, FolderOpen, Plus, Trash2, FilePlus, FolderPlus } from "lucide-react";

interface FileTreeProps {
  tree: Record<string, any>;
  onFileSelect: (path: string) => void;
  onCreate: (path: string, type: "file" | "folder") => void;
  onDelete: (path: string) => void;
  activeFile?: string;
}

function FileTreeNode({ name, node, path, onFileSelect, activeFile, depth, onCreate, onDelete }: {
  name: string;
  node: any;
  path: string;
  onFileSelect: (path: string) => void;
  activeFile?: string;
  depth: number;
  onCreate: (path: string, type: "file" | "folder") => void;
  onDelete: (path: string) => void;
}) {
  const [open, setOpen] = useState(depth < 1);
  const [hovered, setHovered] = useState(false);
  const [creatingChild, setCreatingChild] = useState<"file" | "folder" | null>(null);
  const [newName, setNewName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const isDir = node && !node.type;
  const fullPath = path ? `${path}/${name}` : name;

  useEffect(() => {
    if (creatingChild && inputRef.current) {
      inputRef.current.focus();
    }
  }, [creatingChild]);

  const handleCreateSubmit = () => {
    if (!newName.trim() || !creatingChild) return;
    const childPath = fullPath ? `${fullPath}/${newName.trim()}` : newName.trim();
    onCreate(childPath, creatingChild);
    setCreatingChild(null);
    setNewName("");
    setOpen(true);
  };

  if (isDir) {
    const entries = Object.entries(node);
    return (
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <div className="flex items-center group">
          <button
            onClick={() => setOpen(!open)}
            className="flex items-center gap-1 flex-1 min-w-0 px-2 py-1 text-left text-sm hover:opacity-80"
            style={{ color: "var(--foreground)", paddingLeft: `${depth * 16 + 8}px` }}
          >
            {open ? <ChevronDown className="w-3.5 h-3.5 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 shrink-0" />}
            {open ? <FolderOpen className="w-4 h-4 shrink-0" style={{ color: "var(--accent)" }} /> : <Folder className="w-4 h-4 shrink-0" style={{ color: "var(--accent)" }} />}
            <span className="truncate">{name}</span>
          </button>
          <div className="flex items-center gap-0.5 pr-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => { e.stopPropagation(); setCreatingChild("file"); }}
              className="p-0.5 rounded hover:opacity-80"
              style={{ color: "var(--muted-foreground)" }}
              title="New File"
            >
              <FilePlus className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setCreatingChild("folder"); }}
              className="p-0.5 rounded hover:opacity-80"
              style={{ color: "var(--muted-foreground)" }}
              title="New Folder"
            >
              <FolderPlus className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); if (confirm(`Delete folder "${name}"?`)) onDelete(fullPath); }}
              className="p-0.5 rounded hover:opacity-80"
              style={{ color: "var(--muted-foreground)" }}
              title="Delete"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        {open && (
          <>
            {creatingChild && (
              <div style={{ paddingLeft: `${(depth + 1) * 16 + 24}px` }} className="flex items-center gap-1 py-1">
                {creatingChild === "file" ? (
                  <File className="w-4 h-4 shrink-0" style={{ color: "var(--muted-foreground)" }} />
                ) : (
                  <Folder className="w-4 h-4 shrink-0" style={{ color: "var(--accent)" }} />
                )}
                <input
                  ref={inputRef}
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreateSubmit();
                    if (e.key === "Escape") { setCreatingChild(null); setNewName(""); }
                  }}
                  onBlur={() => { setCreatingChild(null); setNewName(""); }}
                  placeholder={creatingChild === "file" ? "filename.ext" : "folder-name"}
                  className="flex-1 px-1 py-0.5 text-sm rounded outline-none"
                  style={{ background: "var(--background)", color: "var(--foreground)", border: "1px solid var(--accent)" }}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            )}
            {entries.map(([childName, childNode]) => (
              <FileTreeNode
                key={childName}
                name={childName}
                node={childNode}
                path={fullPath}
                onFileSelect={onFileSelect}
                activeFile={activeFile}
                depth={depth + 1}
                onCreate={onCreate}
                onDelete={onDelete}
              />
            ))}
          </>
        )}
      </div>
    );
  }

  const isActive = fullPath === activeFile;
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="flex items-center group"
    >
      <button
        onClick={() => onFileSelect(fullPath)}
        className="flex items-center gap-1 flex-1 min-w-0 px-2 py-1 text-sm"
        style={{
          color: isActive ? "var(--accent)" : "var(--foreground)",
          background: isActive ? "var(--accent)15" : "transparent",
          paddingLeft: `${depth * 16 + 24}px`,
        }}
      >
        <File className="w-4 h-4 shrink-0" style={{ color: "var(--muted-foreground)" }} />
        <span className="truncate">{name}</span>
      </button>
      <button
        onClick={() => { if (confirm(`Delete "${name}"?`)) onDelete(fullPath); }}
        className="p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:opacity-80 mr-1"
        style={{ color: "var(--muted-foreground)" }}
        title="Delete"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export function FileTree({ tree, onFileSelect, activeFile, onCreate, onDelete }: FileTreeProps) {
  const [creatingRoot, setCreatingRoot] = useState<"file" | "folder" | null>(null);
  const [rootName, setRootName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (creatingRoot && inputRef.current) {
      inputRef.current.focus();
    }
  }, [creatingRoot]);

  const handleRootCreate = () => {
    if (!rootName.trim() || !creatingRoot) return;
    onCreate(rootName.trim(), creatingRoot);
    setCreatingRoot(null);
    setRootName("");
  };

  return (
    <div className="overflow-auto h-full" style={{ background: "var(--sidebar)" }}>
      <div className="flex items-center gap-1 px-2 py-1.5 border-b" style={{ borderColor: "var(--border)" }}>
        <button
          onClick={() => setCreatingRoot("file")}
          className="flex items-center gap-1 px-2 py-1 text-xs rounded hover:opacity-80 transition-opacity"
          style={{ color: "var(--muted-foreground)", border: "1px solid var(--border)" }}
        >
          <FilePlus className="w-3.5 h-3.5" /> File
        </button>
        <button
          onClick={() => setCreatingRoot("folder")}
          className="flex items-center gap-1 px-2 py-1 text-xs rounded hover:opacity-80 transition-opacity"
          style={{ color: "var(--muted-foreground)", border: "1px solid var(--border)" }}
        >
          <FolderPlus className="w-3.5 h-3.5" /> Folder
        </button>
      </div>

      {creatingRoot && (
        <div className="flex items-center gap-1 px-2 py-1" style={{ paddingLeft: "32px" }}>
          {creatingRoot === "file" ? (
            <File className="w-4 h-4 shrink-0" style={{ color: "var(--muted-foreground)" }} />
          ) : (
            <Folder className="w-4 h-4 shrink-0" style={{ color: "var(--accent)" }} />
          )}
          <input
            ref={inputRef}
            value={rootName}
            onChange={(e) => setRootName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleRootCreate();
              if (e.key === "Escape") { setCreatingRoot(null); setRootName(""); }
            }}
            onBlur={() => { setCreatingRoot(null); setRootName(""); }}
            placeholder={creatingRoot === "file" ? "filename.ext" : "folder-name"}
            className="flex-1 px-1 py-0.5 text-sm rounded outline-none"
            style={{ background: "var(--background)", color: "var(--foreground)", border: "1px solid var(--accent)" }}
          />
        </div>
      )}

      {Object.entries(tree).map(([name, node]) => (
        <FileTreeNode
          key={name}
          name={name}
          node={node}
          path=""
          onFileSelect={onFileSelect}
          activeFile={activeFile}
          depth={0}
          onCreate={onCreate}
          onDelete={onDelete}
        />
      ))}
      {Object.keys(tree).length === 0 && !creatingRoot && (
        <p className="text-xs text-center py-8" style={{ color: "var(--muted-foreground)" }}>
          No files loaded
        </p>
      )}
    </div>
  );
}
