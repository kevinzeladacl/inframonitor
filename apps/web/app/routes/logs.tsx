import { type LoaderFunctionArgs, type MetaFunction, json } from "@remix-run/node";
import { Form, useLoaderData, useSearchParams } from "@remix-run/react";
import { api } from "~/lib/api.server";
import { requireUser } from "~/lib/auth.server";
import { PageHeader } from "~/components/ui/PageHeader";
import { Field, SelectField } from "~/components/ui/Field";
import { Button } from "~/components/ui/Button";

export const meta: MetaFunction = () => [{ title: "Logs · Inframonitor" }];

interface LogEntry {
  serverId: string;
  containerId?: string;
  source: string;
  level: string;
  message: string;
  ts: string;
}
interface ServerLite { id: string; name: string }

const LEVELS = [
  { value: "", label: "Todos los niveles" },
  { value: "debug", label: "debug" },
  { value: "info", label: "info" },
  { value: "warn", label: "warn" },
  { value: "error", label: "error" },
];

export async function loader({ request }: LoaderFunctionArgs) {
  await requireUser(request);
  const url = new URL(request.url);
  const params: Record<string, string> = {};
  for (const [k, v] of url.searchParams.entries()) if (v) params[k] = v;
  const [logs, servers] = await Promise.all([
    api(request).get<{ items: LogEntry[] }>("/api/v1/logs", { params }),
    api(request).get<{ items: ServerLite[] }>("/api/v1/servers"),
  ]);
  return json({
    items: logs.data?.items ?? [],
    servers: servers.data?.items ?? [],
    filters: params,
  });
}

export default function LogsRoute() {
  const { items, servers, filters } = useLoaderData<typeof loader>();
  const [searchParams] = useSearchParams();
  const serverById = new Map(servers.map((s) => [s.id, s.name] as const));

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader
        title="Logs"
        description="Buffer rotativo 24 h en MongoDB (TTL index). Filtra por server, nivel y texto."
      />

      <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
        <Form method="get" className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
          <SelectField
            label="Servidor"
            name="serverId"
            defaultValue={filters.serverId ?? ""}
            emptyLabel="— Todos —"
            options={servers.map((s) => ({ value: s.id, label: s.name }))}
          />
          <SelectField
            label="Nivel"
            name="level"
            defaultValue={filters.level ?? ""}
            options={LEVELS}
          />
          <Field label="Buscar texto" name="q" defaultValue={filters.q ?? ""} placeholder="connection refused" />
          <Field label="Desde (ISO)" name="since" defaultValue={filters.since ?? ""} placeholder="2026-05-27T00:00:00Z" />
          <Button type="submit">Filtrar</Button>
        </Form>
      </div>

      <div className="flex-1 overflow-auto bg-slate-900 font-mono text-xs p-3">
        {items.length === 0 ? (
          <div className="text-slate-400 p-4">Sin resultados. {searchParams.size === 0 ? "Streams de Fase 5 alimentan esta tabla — abre /servers/:id?tab=logs para empezar a popular." : null}</div>
        ) : null}
        {items.map((l, i) => (
          <div key={i} className="leading-tight whitespace-pre-wrap break-all">
            <span className="text-slate-500 mr-2">{new Date(l.ts).toLocaleString()}</span>
            <span className="text-slate-400 mr-2">{serverById.get(l.serverId)?.slice(0, 15) ?? l.serverId.slice(0, 8)}</span>
            <span className={
              l.level === "error" ? "text-red-400 mr-2" :
              l.level === "warn" ? "text-amber-300 mr-2" :
              "text-slate-200 mr-2"
            }>[{l.level}]</span>
            <span className="text-slate-200">{l.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
