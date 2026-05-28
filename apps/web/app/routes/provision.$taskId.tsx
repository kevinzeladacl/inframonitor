import { type LoaderFunctionArgs, type MetaFunction, json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { useEffect, useRef, useState } from "react";
import { api } from "~/lib/api.server";
import { requireUser } from "~/lib/auth.server";
import { PageHeader } from "~/components/ui/PageHeader";
import { ClientOnly } from "~/components/ClientOnly";

export const meta: MetaFunction = () => [{ title: "Provisioning · Inframonitor" }];

interface ProvisionTask {
  id: string;
  phase: string;
  status: string;
  serverId?: string | null;
  socketRoom: string;
  errorMessage?: string | null;
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  await requireUser(request);
  const res = await api(request).get<ProvisionTask>(`/api/v1/provision/tasks/${params.taskId}`);
  if (res.status >= 400) throw new Response("Task no encontrada", { status: 404 });
  return json({ task: res.data });
}

export default function ProvisionTaskRoute() {
  const { task } = useLoaderData<typeof loader>();
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader
        title="Provisioning en curso"
        description={`Task ${task.id} · Room ${task.socketRoom}`}
      />
      <ClientOnly fallback={<div className="p-6 text-slate-500">Conectando al stream...</div>}>
        {() => <ProvisionStream task={task} />}
      </ClientOnly>
    </div>
  );
}

interface Event {
  kind: "phase" | "log" | "step:start" | "step:output" | "step:end" | "run:done" | "run:error" | "done" | "error" | "info";
  data: any;
  ts: number;
}

function ProvisionStream({ task }: { task: ProvisionTask }) {
  const [phase, setPhase] = useState(task.phase);
  const [status, setStatus] = useState(task.status);
  const [serverId, setServerId] = useState<string | null>(task.serverId ?? null);
  const [events, setEvents] = useState<Event[]>([]);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cleanup: (() => void) | null = null;
    let disposed = false;
    (async () => {
      const ioMod = await import("socket.io-client");
      if (disposed) return;
      const apiOrigin = window.location.origin.replace(":5274", ":8301");
      const socket = ioMod.io(`${apiOrigin}/provision`, {
        withCredentials: true,
        transports: ["websocket", "polling"],
      });

      socket.on("connect", () => socket.emit("join", task.socketRoom));
      socket.on("phase", (data: any) => {
        setPhase(data.phase);
        setEvents((prev) => [...prev, { kind: "phase", data, ts: Date.now() }]);
      });
      socket.on("log", (data: any) => setEvents((prev) => [...prev, { kind: "log", data, ts: Date.now() }]));
      socket.on("step:start", (data: any) => setEvents((prev) => [...prev, { kind: "step:start", data, ts: Date.now() }]));
      socket.on("step:output", (data: any) => setEvents((prev) => [...prev, { kind: "step:output", data, ts: Date.now() }]));
      socket.on("step:end", (data: any) => setEvents((prev) => [...prev, { kind: "step:end", data, ts: Date.now() }]));
      socket.on("run:done", () => setStatus("success"));
      socket.on("run:error", (data: any) => {
        setStatus("failed");
        setEvents((prev) => [...prev, { kind: "run:error", data, ts: Date.now() }]);
      });
      socket.on("server-created", (data: any) => setServerId(data.serverId));
      socket.on("done", (data: any) => {
        setStatus("success");
        setEvents((prev) => [...prev, { kind: "done", data, ts: Date.now() }]);
      });
      socket.on("error", (msg: string) => {
        setStatus("failed");
        setEvents((prev) => [...prev, { kind: "error", data: { message: msg }, ts: Date.now() }]);
      });

      cleanup = () => socket.disconnect();
    })().catch(console.error);

    return () => {
      disposed = true;
      if (cleanup) cleanup();
    };
  }, [task.socketRoom]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [events]);

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4 border-b border-slate-200 bg-white flex items-center gap-6">
        <PhaseStepper current={phase} />
        <div className="ml-auto flex items-center gap-3 text-sm">
          <span className={
            status === "success" ? "text-emerald-700 font-medium" :
            status === "failed" ? "text-red-700 font-medium" :
            "text-amber-700 font-medium"
          }>
            {status.toUpperCase()}
          </span>
          {serverId ? (
            <a href={`/servers/${serverId}`} className="text-brand-600 underline">Ver server →</a>
          ) : null}
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-auto bg-slate-900 font-mono text-xs p-4 leading-tight">
        {events.length === 0 ? (
          <div className="text-slate-500">Esperando eventos del backend...</div>
        ) : null}
        {events.map((e, i) => (
          <div key={i} className="whitespace-pre-wrap break-all">
            <span className="text-slate-500 mr-2">{new Date(e.ts).toLocaleTimeString()}</span>
            <EventLine event={e} />
          </div>
        ))}
      </div>
    </div>
  );
}

function EventLine({ event }: { event: Event }) {
  switch (event.kind) {
    case "phase":
      return <span className="text-cyan-400">[phase] {event.data.phase}</span>;
    case "log":
      return <span className={event.data.level === "error" ? "text-red-400" : "text-slate-200"}>{event.data.line}</span>;
    case "step:start":
      return <span className="text-amber-300">▶ step {event.data.index + 1}: {event.data.name}</span>;
    case "step:output":
      return <span className="text-slate-300 pl-4">  {event.data.line}</span>;
    case "step:end":
      return (
        <span className={event.data.ok ? "text-emerald-400" : "text-red-400"}>
          {event.data.ok ? "✓" : "✗"} step {event.data.index + 1} exit={event.data.code} ({event.data.ms}ms)
        </span>
      );
    case "run:done":
    case "done":
      return <span className="text-emerald-400 font-bold">✓ DONE</span>;
    case "run:error":
    case "error":
      return <span className="text-red-400 font-bold">✗ {event.data.message}</span>;
    default:
      return <span className="text-slate-300">{JSON.stringify(event.data)}</span>;
  }
}

const PHASES = ["creating-vm", "waiting-ssh", "running-playbook", "done"];

function PhaseStepper({ current }: { current: string }) {
  const currentIdx = PHASES.indexOf(current);
  return (
    <div className="flex items-center gap-2 text-sm">
      {PHASES.map((p, i) => {
        const done = i < currentIdx || current === "done";
        const active = i === currentIdx && current !== "done";
        return (
          <div key={p} className="flex items-center gap-2">
            <span className={
              done ? "size-5 rounded-full bg-emerald-500 text-white text-[10px] flex items-center justify-center" :
              active ? "size-5 rounded-full bg-amber-500 text-white text-[10px] flex items-center justify-center animate-pulse" :
              "size-5 rounded-full bg-slate-300 text-white text-[10px] flex items-center justify-center"
            }>
              {done ? "✓" : i + 1}
            </span>
            <span className={done ? "text-emerald-700" : active ? "text-amber-700 font-medium" : "text-slate-500"}>
              {p}
            </span>
            {i < PHASES.length - 1 ? <span className="text-slate-300">→</span> : null}
          </div>
        );
      })}
    </div>
  );
}
