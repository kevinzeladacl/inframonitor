import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";

interface LogLine {
  serverId: string;
  containerId?: string;
  source: "docker" | "syslog" | "playbook" | "ssh";
  level: "debug" | "info" | "warn" | "error";
  message: string;
  ts: string;
}

const LEVEL_COLOR: Record<string, string> = {
  debug: "text-slate-500",
  info: "text-slate-200",
  warn: "text-amber-300",
  error: "text-red-400",
};

export function LiveLogs({
  serverId,
  containerId,
  height = "400px",
}: {
  serverId: string;
  containerId?: string;
  height?: string;
}) {
  const [lines, setLines] = useState<LogLine[]>([]);
  const [paused, setPaused] = useState(false);
  const [status, setStatus] = useState<"connecting" | "ready" | "error">("connecting");
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  useEffect(() => {
    const apiOrigin = window.location.origin.replace(":5274", ":8301");
    const socket: Socket = io(`${apiOrigin}/logs`, {
      withCredentials: true,
      transports: ["websocket", "polling"],
    });

    socket.on("connect", () => {
      socket.emit("subscribe", { serverId, containerId });
    });
    socket.on("subscribed", () => setStatus("ready"));
    socket.on("connect_error", (err: Error) => {
      setStatus("error");
      setError(err.message);
    });
    socket.on("error", (msg: string) => {
      setStatus("error");
      setError(msg);
    });
    socket.on("log:line", (line: LogLine) => {
      if (pausedRef.current) return;
      setLines((prev) => {
        const next = [...prev.slice(-999), line];
        return next;
      });
    });

    return () => {
      socket.emit("unsubscribe", { serverId, containerId });
      socket.disconnect();
    };
  }, [serverId, containerId]);

  useEffect(() => {
    if (!paused && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [lines, paused]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 bg-slate-50 text-sm">
        <div className="flex items-center gap-2">
          <span className={
            status === "ready" ? "size-2 rounded-full bg-emerald-500" :
            status === "error" ? "size-2 rounded-full bg-red-500" :
            "size-2 rounded-full bg-amber-500"
          } />
          <span className="text-slate-700">{status}</span>
          {error ? <span className="text-red-700 text-xs">{error}</span> : null}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPaused((p) => !p)}
            className="text-xs px-2 py-1 rounded border border-slate-300 hover:bg-slate-100"
          >
            {paused ? "Reanudar" : "Pausar"}
          </button>
          <button
            onClick={() => setLines([])}
            className="text-xs px-2 py-1 rounded border border-slate-300 hover:bg-slate-100"
          >
            Limpiar
          </button>
        </div>
      </div>
      <div
        ref={scrollRef}
        className="flex-1 overflow-auto bg-slate-900 font-mono text-xs p-3 leading-tight"
        style={{ minHeight: height }}
      >
        {lines.length === 0 ? (
          <div className="text-slate-500">Esperando líneas…</div>
        ) : null}
        {lines.map((l, i) => (
          <div key={i} className="whitespace-pre-wrap break-all">
            <span className="text-slate-500 mr-2">{new Date(l.ts).toLocaleTimeString()}</span>
            <span className="text-slate-400 mr-2 uppercase">{l.source}</span>
            <span className={LEVEL_COLOR[l.level] ?? "text-slate-200"}>{l.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
