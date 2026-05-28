import {
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
  type MetaFunction,
  json,
  redirect,
} from "@remix-run/node";
import { Form, useLoaderData, useSearchParams, useActionData, useFetcher } from "@remix-run/react";
import { Trash2, Pencil, Plus, X } from "lucide-react";
import { api } from "~/lib/api.server";
import { requireUser } from "~/lib/auth.server";
import { handleCrudAction } from "~/lib/crud.server";
import { PageHeader } from "~/components/ui/PageHeader";
import { Field, SelectField } from "~/components/ui/Field";
import { Button } from "~/components/ui/Button";

export const meta: MetaFunction = () => [{ title: "Contenedores · Inframonitor" }];

interface ContainerItem {
  id: string;
  serverId: string;
  containerId: string;
  name: string;
  image: string;
  state: string;
  environmentId?: string | null;
  projectId?: string | null;
  clientId?: string | null;
}
interface Lite { id: string; name: string }

const STATE_OPTIONS = [
  { value: "running", label: "running" },
  { value: "exited", label: "exited" },
  { value: "restarting", label: "restarting" },
  { value: "paused", label: "paused" },
  { value: "dead", label: "dead" },
  { value: "created", label: "created" },
];

export async function loader({ request }: LoaderFunctionArgs) {
  await requireUser(request);
  const [containers, servers, envs, projects, clients] = await Promise.all([
    api(request).get<{ items: ContainerItem[] }>("/api/v1/containers"),
    api(request).get<{ items: Lite[] }>("/api/v1/servers"),
    api(request).get<{ items: (Lite & { projectId: string })[] }>("/api/v1/environments"),
    api(request).get<{ items: Lite[] }>("/api/v1/projects"),
    api(request).get<{ items: Lite[] }>("/api/v1/clients"),
  ]);
  return json({
    items: containers.data?.items ?? [],
    servers: servers.data?.items ?? [],
    environments: envs.data?.items ?? [],
    projects: projects.data?.items ?? [],
    clients: clients.data?.items ?? [],
  });
}

export async function action({ request }: ActionFunctionArgs) {
  await requireUser(request);
  const form = await request.formData();
  const result = await handleCrudAction(request, "/api/v1/containers", form);
  // Si vino de un fetcher (assign), devolver JSON para que no recargue la página completa
  if (form.get("source") === "fetcher") {
    return json(result, { status: result.ok ? 200 : 400 });
  }
  if (result.ok) return redirect("/containers");
  return json(result, { status: 400 });
}

export default function ContainersRoute() {
  const { items, servers, environments, projects, clients } = useLoaderData<typeof loader>();
  const [params] = useSearchParams();
  const editingId = params.get("edit");
  const editing = items.find((i) => i.id === editingId);
  const actionData = useActionData<typeof action>();

  const serverOpts = servers.map((s) => ({ value: s.id, label: s.name }));
  const envOpts = environments.map((e) => ({ value: e.id, label: `${e.name} · ${projects.find((p) => p.id === e.projectId)?.name ?? "?"}` }));
  const projOpts = projects.map((p) => ({ value: p.id, label: p.name }));
  const clientOpts = clients.map((c) => ({ value: c.id, label: c.name }));

  const serverById = new Map(servers.map((s) => [s.id, s.name] as const));
  const envById = new Map(environments.map((e) => [e.id, e.name] as const));
  const projById = new Map(projects.map((p) => [p.id, p.name] as const));
  const clientById = new Map(clients.map((c) => [c.id, c.name] as const));

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader
        title="Contenedores"
        description="Docker corriendo en tus servidores. Asigna a ambiente/proyecto/cliente desde los selects inline."
      />

      <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
        <Form method="post" className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
          <input type="hidden" name="intent" value={editing ? "update" : "create"} />
          {editing ? <input type="hidden" name="id" value={editing.id} /> : null}

          <SelectField label="Servidor" name="serverId" defaultValue={editing?.serverId} options={serverOpts} required />
          <Field label="Nombre" name="name" required defaultValue={editing?.name} placeholder="api" />
          <Field label="Imagen" name="image" required defaultValue={editing?.image} placeholder="node:20-alpine" />
          <Field label="Container ID" name="containerId" required defaultValue={editing?.containerId} placeholder="sha-12chars" />
          <SelectField label="Estado" name="state" defaultValue={editing?.state ?? "running"} options={STATE_OPTIONS} />

          <div className="flex gap-2 justify-end">
            <Button type="submit">{editing ? "Actualizar" : <><Plus className="size-3.5" />Crear</>}</Button>
            {editing ? (
              <Button type="button" variant="secondary" onClick={() => (window.location.search = "")}>
                <X className="size-3.5" /> Cancelar
              </Button>
            ) : null}
          </div>
        </Form>

        {actionData && !actionData.ok ? (
          <div className="mt-3 text-sm text-red-700">
            {actionData.error}
            {actionData.details ? <pre className="mt-1 text-xs bg-red-50 p-2 rounded">{JSON.stringify(actionData.details, null, 2)}</pre> : null}
          </div>
        ) : null}
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
            <tr className="text-left">
              <th className="px-6 py-2 font-medium text-slate-700">Nombre</th>
              <th className="px-6 py-2 font-medium text-slate-700">Imagen</th>
              <th className="px-6 py-2 font-medium text-slate-700">Servidor</th>
              <th className="px-6 py-2 font-medium text-slate-700">Estado</th>
              <th className="px-6 py-2 font-medium text-slate-700">Ambiente</th>
              <th className="px-6 py-2 font-medium text-slate-700">Proyecto</th>
              <th className="px-6 py-2 font-medium text-slate-700">Cliente</th>
              <th className="px-6 py-2 font-medium text-slate-700 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr><td colSpan={8} className="px-6 py-8 text-center text-slate-500">Sin contenedores.</td></tr>
            ) : null}
            {items.map((c) => (
              <ContainerRow
                key={c.id}
                c={c}
                serverName={serverById.get(c.serverId) ?? "?"}
                envOpts={envOpts}
                projOpts={projOpts}
                clientOpts={clientOpts}
                envName={c.environmentId ? envById.get(c.environmentId) : undefined}
                projName={c.projectId ? projById.get(c.projectId) : undefined}
                clientName={c.clientId ? clientById.get(c.clientId) : undefined}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ContainerRow({
  c,
  serverName,
  envOpts,
  projOpts,
  clientOpts,
}: {
  c: ContainerItem;
  serverName: string;
  envOpts: { value: string; label: string }[];
  projOpts: { value: string; label: string }[];
  clientOpts: { value: string; label: string }[];
  envName?: string;
  projName?: string;
  clientName?: string;
}) {
  const fetcher = useFetcher();

  const updateField = (field: "environmentId" | "projectId" | "clientId") =>
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      fetcher.submit(
        {
          intent: "update",
          id: c.id,
          source: "fetcher",
          [field]: e.target.value,
        },
        { method: "post" }
      );
    };

  return (
    <tr className="border-b border-slate-100 hover:bg-slate-50">
      <td className="px-6 py-2 font-medium">{c.name}</td>
      <td className="px-6 py-2 font-mono text-xs text-slate-600">{c.image}</td>
      <td className="px-6 py-2 text-slate-600">{serverName}</td>
      <td className="px-6 py-2">
        <span className={`inline-block px-2 py-0.5 rounded text-xs ${
          c.state === "running" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"
        }`}>{c.state}</span>
      </td>
      <td className="px-6 py-2">
        <select value={c.environmentId ?? ""} onChange={updateField("environmentId")}
          className="text-xs rounded border border-slate-200 px-1.5 py-0.5 bg-white">
          <option value="">—</option>
          {envOpts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </td>
      <td className="px-6 py-2">
        <select value={c.projectId ?? ""} onChange={updateField("projectId")}
          className="text-xs rounded border border-slate-200 px-1.5 py-0.5 bg-white">
          <option value="">—</option>
          {projOpts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </td>
      <td className="px-6 py-2">
        <select value={c.clientId ?? ""} onChange={updateField("clientId")}
          className="text-xs rounded border border-slate-200 px-1.5 py-0.5 bg-white">
          <option value="">—</option>
          {clientOpts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </td>
      <td className="px-6 py-2 text-right">
        <div className="inline-flex gap-1.5">
          <a href={`/containers?edit=${c.id}`}>
            <Button size="sm" variant="secondary"><Pencil className="size-3.5" /></Button>
          </a>
          <Form method="post" className="inline">
            <input type="hidden" name="intent" value="delete" />
            <input type="hidden" name="id" value={c.id} />
            <Button size="sm" variant="danger" type="submit"
              onClick={(e) => { if (!confirm(`¿Eliminar contenedor "${c.name}"?`)) e.preventDefault(); }}>
              <Trash2 className="size-3.5" />
            </Button>
          </Form>
        </div>
      </td>
    </tr>
  );
}
