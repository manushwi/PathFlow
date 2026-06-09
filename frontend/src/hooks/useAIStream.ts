export async function streamChat(
  workspaceId: number,
  message: string,
  onChunk: (text: string) => void,
  onDone: () => void,
  onError?: (err: Error) => void
) {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/ai/chat`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspace_id: workspaceId, message }),
    });
    if (!res.ok || !res.body) {
      onError?.(new Error(`Request failed: ${res.status}`));
      onDone();
      return;
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      const lines = decoder.decode(value).split("\n");
      for (const line of lines) {
        if (line.startsWith("data: ")) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.text) onChunk(data.text);
            if (data.done) onDone();
          } catch {}
        }
      }
    }
  } catch (err) {
    onError?.(err instanceof Error ? err : new Error(String(err)));
    onDone();
  }
}
