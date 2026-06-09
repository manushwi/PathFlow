"use client";
import { useState, useEffect, useRef } from "react";
import useSWR from "swr";
import { api } from "@/lib/api";
import { streamChat } from "@/hooks/useAIStream";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SendHorizonal, Bot, User, Sparkles } from "lucide-react";

interface AIAssistantPanelProps {
  workspaceId: number;
}

export function AIAssistantPanel({ workspaceId }: AIAssistantPanelProps) {
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { data: history } = useSWR(`/chat-history/${workspaceId}`, () => api.ai.chatHistory(workspaceId));

  useEffect(() => {
    if (history?.messages) {
      setMessages(history.messages);
    }
  }, [history]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || streaming) return;
    const userMsg = { role: "user", content: input };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setStreaming(true);
    const assistantMsg = { role: "assistant", content: "" };
    setMessages((prev) => [...prev, assistantMsg]);
    await streamChat(
      workspaceId,
      userMsg.content,
      (chunk) => {
        setMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last && last.role === "assistant") {
            last.content += chunk;
          }
          return updated;
        });
      },
      () => setStreaming(false)
    );
  };

  const quickActions = [
    { label: "Explain this file", icon: Sparkles },
    { label: "Find usages", icon: Sparkles },
    { label: "Generate tests", icon: Sparkles },
  ];

  return (
    <div className="flex flex-col h-full" style={{ background: "var(--sidebar)" }}>
      <div className="p-3 border-b text-sm font-medium flex items-center gap-2"
           style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}>
        <Bot className="w-4 h-4" style={{ color: "var(--accent)" }} />
        AI Assistant
      </div>

      <ScrollArea className="flex-1 p-3" ref={scrollRef}>
        {messages.length === 0 && (
          <div className="text-center py-8">
            <Bot className="w-10 h-10 mx-auto mb-3" style={{ color: "var(--accent)" }} />
            <p className="text-sm mb-4" style={{ color: "var(--muted-foreground)" }}>
              Ask me anything about this codebase
            </p>
            <div className="space-y-2">
              {quickActions.map((action) => (
                <button
                  key={action.label}
                  onClick={() => setInput(action.label)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm w-full transition-colors"
                  style={{ background: "var(--card)", color: "var(--muted-foreground)", border: "1px solid var(--border)" }}
                >
                  <action.icon className="w-3.5 h-3.5" />
                  {action.label}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="space-y-4">
          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-2 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
              <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                   style={{ background: msg.role === "user" ? "var(--accent)" : "var(--card)" }}>
                {msg.role === "user" ? (
                  <User className="w-3.5 h-3.5 text-white" />
                ) : (
                  <Bot className="w-3.5 h-3.5" style={{ color: "var(--accent)" }} />
                )}
              </div>
              <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                msg.role === "user" ? "" : ""
              }`} style={{
                background: msg.role === "user" ? "var(--accent)" : "var(--card)",
                color: msg.role === "user" ? "white" : "var(--foreground)",
              }}>
                <pre className="whitespace-pre-wrap font-sans text-sm">{msg.content || (streaming && i === messages.length - 1 ? "..." : "")}</pre>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      <div className="p-3 border-t" style={{ borderColor: "var(--border)" }}>
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), handleSend())}
            placeholder="Ask about the code..."
            disabled={streaming}
            style={{ background: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }}
          />
          <Button size="icon" onClick={handleSend} disabled={streaming || !input.trim()}
                  style={{ background: "var(--accent)" }}>
            <SendHorizonal className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
