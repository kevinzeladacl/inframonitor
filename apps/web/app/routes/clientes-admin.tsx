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

export const meta: MetaFunction = () => [{ title: "Clientes · Admin · Inframonitor" }];

interface ClientItem {
  id: string;
  name: string;
  type: "municipality" | "internal" | "external" | "demo";
  contactEmail?: string | null;
  notes?: string | null;
  colorHex?: string;
}

export async function loader({ request }: LoaderFunctionArgs) {
  await requireUser(request);
  const res = await api(request).get<{ items: ClientItem[] }>("/api/v1/clients");
  return json({ items: res.data?.items ?? [] });
}

export async function action({ request }: ActionFunctionArgs) {
  await requireUser(request);
  const form = await request.formData();
  const result = await handleCrudAction(request, "/api/v1/clients", form);
  if (result.ok) return redirect("/clientes-admin");
  return json(result, { status: 400 });
}

const TYPE_OPTIONS = [
  { value: "external", label: "Externo" },
  { value: "internal", label: "Interno" },
  { value: "municipality", label: "Municipalidad" },
  { value: "demo", label: "Demo" },
];

export default function ClientesAdminRoute() {
  const { items } = useLoaderData<typeof loader>();
  const [params] = useSearchParams();
  const editingId = params.get("edit");
  const editing = items.find((i) => i.id === editingId);
  const actionData = useActionData<typeof action>();

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader
        title="Clientes (Admin)"
        description="CRUD del catálogo de clientes/deploys finales (Isla de Maipo, Muni Providencia, etc.)"
      />

      <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
        <Form method="post" className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
          <input type="hidden" name="intent" value={editing ? "update" : "create"} />
          {editing ? <input type="hidden" name="id" value={editing.id} /> : null}

          <Field label="Nombre" name="name" required defaultValue={editing?.name} />
          <SelectField label="Tipo" name="type" defaultValue={editing?.type ?? "external"} options={TYPE_OPTIONS} />
          <Field label="Email contacto" name="contactEmail" type="email" defaultValue={editing?.contactEmail ?? ""} />
          <Field label="Color" name="colorHex" type="color" defaultValue={editing?.colorHex ?? "#10b981"} />

          <div className="flex gap-2">
            <Button type="submit">
              {editing ? "Actualizar" : <><Plus className="size-3.5" />Crear</>}
            </Button>
            {editing ? (
              <Button type="button" variant="secondary" onClick={() => (window.location.search = "")}>
                <X className="size-3.5" /> Cancelar
              </Button>
            ) : null}
          </div>
        </Form>

        {actionData && !actionData.ok ? (
          <div className="mt-3 text-sm text-red-700">{actionData.error}</div>
        ) : null}
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
            <tr className="text-left">
              <th className="px-6 py-2 font-medium text-slate-700">Nombre</th>
              <th className="px-6 py-2 font-medium text-slate-700">Tipo</th>
              <th className="px-6 py-2 font-medium text-slate-700">Email</th>
              <th className="px-6 py-2 font-medium text-slate-700">Color</th>
              <th className="px-6 py-2 font-medium text-slate-700 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-500">Sin clientes. Crea el primero arriba.</td></tr>
            ) : null}
            {items.map((c) => (
              <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="px-6 py-2 font-medium">{c.name}</td>
                <td className="px-6 py-2 text-slate-600">{c.type}</td>
                <td className="px-6 py-2 text-slate-600">{c.contactEmail ?? "—"}</td>
                <td className="px-6 py-2">
                  <span className="inline-block size-5 rounded border border-slate-300" style={{ background: c.colorHex }} />
                </td>
                <td className="px-6 py-2 text-right">
                  <div className="inline-flex gap-1.5">
                    <a href={`/clientes-admin?edit=${c.id}`}>
                      <Button size="sm" variant="secondary"><Pencil className="size-3.5" /></Button>
                    </a>
                    <Form method="post" className="inline">
                      <input type="hidden" name="intent" value="delete" />
                      <input type="hidden" name="id" value={c.id} />
                      <Button size="sm" variant="danger" type="submit"
                        onClick={(e) => { if (!confirm(`¿Eliminar "${c.name}"?`)) e.preventDefault(); }}>
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
