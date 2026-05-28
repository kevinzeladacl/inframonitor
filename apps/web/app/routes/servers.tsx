import {
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
  type MetaFunction,
  json,
  redirect,
} from "@remix-run/node";
import { Form, useLoaderData, useSearchParams, useActionData } from "@remix-run/react";
import { Trash2, Pencil, Plus, X } from "lucide-react";
import { api } from "~/lib/api.server";
import { requireUser } from "~/lib/auth.server";
import { handleCrudAction } from "~/lib/crud.server";
import { PageHeader } from "~/components/ui/PageHeader";
import { Field, SelectField } from "~/components/ui/Field";
import { Button } from "~/components/ui/Button";

export const meta: MetaFunction = () => [{ title: "Servidores · Inframonitor" }];

interface ServerItem {
  id: string;
  name: string;
  provider: "aws" | "digitalocean" | "azure";
  cloudSourceId: string;
  region: string;
  publicIp?: string | null;
  privateIp?: string | null;
  os?: string | null;
  status: string;
  costEstimate?: { monthlyUsd?: number };
}
interface CloudSourceLite { id: string; name: string; provider: string }

const PROVIDER_OPTIONS = [
  { value: "digitalocean", label: "DigitalOcean" },
  { value: "aws", label: "AWS" },
  { value: "azure", label: "Azure" },
];
const STATUS_OPTIONS = [
  { value: "running", label: "running" },
  { value: "stopped", label: "stopped" },
  { value: "provisioning", label: "provisioning" },
  { value: "error", label: "error" },
  { value: "terminated", label: "terminated" },
];
const STATUS_COLORS: Record<string, string> = {
  running: "bg-emerald-100 text-emerald-700",
  stopped: "bg-slate-100 text-slate-600",
  provisioning: "bg-amber-100 text-amber-700",
  error: "bg-red-100 text-red-700",
  terminated: "bg-slate-200 text-slate-500",
};

export async function loader({ request }: LoaderFunctionArgs) {
  await requireUser(request);
  const [servers, cloudSources] = await Promise.all([
    api(request).get<{ items: ServerItem[] }>("/api/v1/servers"),
    api(request).get<{ items: CloudSourceLite[] }>("/api/v1/cloud-sources").catch(() => ({ data: { items: [] } })),
  ]);
  return json({
    items: servers.data?.items ?? [],
    cloudSources: cloudSources.data?.items ?? [],
  });
}

export async function action({ request }: ActionFunctionArgs) {
  await requireUser(request);
  const form = await request.formData();
  const result = await handleCrudAction(request, "/api/v1/servers", form);
  if (result.ok) return redirect("/servers");
  return json(result, { status: 400 });
}

export default function ServersRoute() {
  const { items, cloudSources } = useLoaderData<typeof loader>();
  const [params] = useSearchParams();
  const editingId = params.get("edit");
  const editing = items.find((i) => i.id === editingId);
  const actionData = useActionData<typeof action>();

  const cloudOptions =
    cloudSources.length > 0
      ? cloudSources.map((c) => ({ value: c.id, label: `${c.name} (${c.provider})` }))
      : [{ value: editing?.cloudSourceId ?? "manual", label: "manual (Fase 3 trae Cloud Sources reales)" }];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader
        title="Servidores"
        description="VMs gestionadas. La creación real por provider llega en Fase 7 (wizard); por ahora alta manual."
      />

      <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
        <Form method="post" className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
          <input type="hidden" name="intent" value={editing ? "update" : "create"} />
          {editing ? <input type="hidden" name="id" value={editing.id} /> : null}

          <Field label="Nombre" name="name" required defaultValue={editing?.name} placeholder="web-prod-01" />
          <SelectField label="Provider" name="provider" defaultValue={editing?.provider ?? "digitalocean"} options={PROVIDER_OPTIONS} required />
          <SelectField label="Cloud Source" name="cloudSourceId" defaultValue={editing?.cloudSourceId} options={cloudOptions} required />
          <Field label="Región" name="region" required defaultValue={editing?.region} placeholder="nyc3" />
          <Field label="IP pública" name="publicIp" defaultValue={editing?.publicIp ?? ""} placeholder="203.0.113.10" />
          <SelectField label="Estado" name="status" defaultValue={editing?.status ?? "running"} options={STATUS_OPTIONS} />

          <Field label="IP privada" name="privateIp" defaultValue={editing?.privateIp ?? ""} placeholder="10.0.0.10" />
          <Field label="SO" name="os" defaultValue={editing?.os ?? ""} placeholder="ubuntu-22.04" />
          <Field label="Costo mensual USD" name="monthlyUsd" type="number" defaultValue={editing?.costEstimate?.monthlyUsd} />

          <div className="md:col-span-3 flex gap-2 justify-end">
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
              <th className="px-6 py-2 font-medium text-slate-700">Provider</th>
              <th className="px-6 py-2 font-medium text-slate-700">Región</th>
              <th className="px-6 py-2 font-medium text-slate-700">IP pública</th>
              <th className="px-6 py-2 font-medium text-slate-700">SO</th>
              <th className="px-6 py-2 font-medium text-slate-700">Estado</th>
              <th className="px-6 py-2 font-medium text-slate-700">Costo/mes</th>
              <th className="px-6 py-2 font-medium text-slate-700 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr><td colSpan={8} className="px-6 py-8 text-center text-slate-500">Sin servidores.</td></tr>
            ) : null}
            {items.map((s) => (
              <tr key={s.id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="px-6 py-2 font-medium">{s.name}</td>
                <td className="px-6 py-2 text-slate-600 uppercase text-xs">{s.provider}</td>
                <td className="px-6 py-2 text-slate-600">{s.region}</td>
                <td className="px-6 py-2 font-mono text-slate-600 text-xs">{s.publicIp ?? "—"}</td>
                <td className="px-6 py-2 text-slate-600">{s.os ?? "—"}</td>
                <td className="px-6 py-2">
                  <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[s.status] ?? "bg-slate-100 text-slate-600"}`}>
                    {s.status}
                  </span>
                </td>
                <td className="px-6 py-2 text-slate-600">
                  {typeof s.costEstimate?.monthlyUsd === "number" ? `$${s.costEstimate.monthlyUsd}` : "—"}
                </td>
                <td className="px-6 py-2 text-right">
                  <div className="inline-flex gap-1.5">
                    <a href={`/servers?edit=${s.id}`}>
                      <Button size="sm" variant="secondary"><Pencil className="size-3.5" /></Button>
                    </a>
                    <Form method="post" className="inline">
                      <input type="hidden" name="intent" value="delete" />
                      <input type="hidden" name="id" value={s.id} />
                      <Button size="sm" variant="danger" type="submit"
                        onClick={(e) => { if (!confirm(`¿Eliminar servidor "${s.name}"?`)) e.preventDefault(); }}>
                        <Trash2 className="size-3.5" />
                      </Button>
                    </Form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
