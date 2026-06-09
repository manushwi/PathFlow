"use client";
import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const SKILLS = [
  { value: "beginner", label: "Beginner", description: "New to open source, learning the basics" },
  { value: "intermediate", label: "Intermediate", description: "Comfortable with git, have contributed before" },
  { value: "advanced", label: "Advanced", description: "Experienced contributor, know the codebase patterns" },
];

export function SkillDialog() {
  const { user, mutate } = useAuth();
  const [open, setOpen] = useState(!user?.skill_confirmed);
  const [selected, setSelected] = useState(user?.skill_level || "beginner");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.auth.updateSkill(selected);
      await mutate();
      setOpen(false);
      toast.success("Skill level set", { description: `Set to ${selected}` });
    } catch {
      toast.error("Failed to save skill level");
    } finally {
      setSaving(false);
    }
  };

  if (user?.skill_confirmed) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (v === false && !user?.skill_confirmed) return; setOpen(v); }}>
      <DialogContent className="max-w-md" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
        <DialogHeader>
          <DialogTitle style={{ color: "var(--foreground)" }}>What&apos;s your skill level?</DialogTitle>
          <DialogDescription style={{ color: "var(--muted-foreground)" }}>
            This helps us recommend the right issues for you. You can change it anytime.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 py-4">
          {SKILLS.map((skill) => (
            <button
              key={skill.value}
              onClick={() => setSelected(skill.value)}
              className="flex items-start gap-3 rounded-lg border p-4 text-left transition-all"
              style={{
                borderColor: selected === skill.value ? "var(--accent)" : "var(--border)",
                background: selected === skill.value ? "var(--accent)10" : "var(--background)",
              }}
            >
              <div className="mt-0.5 h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0"
                   style={{
                     borderColor: selected === skill.value ? "var(--accent)" : "var(--muted-foreground)",
                   }}>
                {selected === skill.value && (
                  <div className="h-2 w-2 rounded-full" style={{ background: "var(--accent)" }} />
                )}
              </div>
              <div>
                <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>{skill.label}</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>{skill.description}</p>
              </div>
            </button>
          ))}
        </div>
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving} style={{ background: "var(--accent)" }}>
            {saving ? "Saving..." : "Confirm"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}