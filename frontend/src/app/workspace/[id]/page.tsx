"use client";
import { useParams } from "next/navigation";
import { IDELayout } from "@/components/ide/IDELayout";

export default function WorkspaceIDEPage() {
  const params = useParams();
  const workspaceId = Number(params.id);

  return (
    <div className="h-screen w-screen overflow-hidden" style={{ background: "var(--background)" }}>
      <IDELayout workspaceId={workspaceId} />
    </div>
  );
}
