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

export const meta: MetaFunction = () => [{ title: "Proyectos · Inframonitor" }];

interface ProjectItem {
  id: string;
  name: string;
  slug: string;
  repoUrl?: string | null;
  description?: string | null;
  ownerClientId?: string | null;
  colorHex?: string;
}
interface ClientLite { id: string; name: string }

export async function loader({ request }: LoaderFunctionArgs) {
  await requireUser(request);
  const [projects, clients] = await Promise.all([
    api(request).get<{ items: ProjectItem[] }>("/api/v1/projects"),
    api(request).get<{ items: ClientLite[] }>("/api/v1/clients"),
  ]);
  return json({
    items: projects.data?.items ?? [],
    clients: clients.data?.items ?? [],
  });
}

export async function action({ request }: ActionFunctionArgs) {
  await requireUser(request);
  const form = await request.formData();
  const result = await handleCrudAction(request, "/api/v1/projects", form);
  if (result.ok) return redirect("/projects");
  return json(result, { status: 400 });
}

export default function ProjectsRoute() {
  const { items, clients } = useLoaderData<typeof loader>();
  const [params] = useSearchParams();
  const editingId = params.get("edit");
  const editing = items.find((i) => i.id === editingId);
  const actionData = useActionData<typeof action>();

  const clientOptions = clients.map((c) => ({ value: c.id, label: c.name }));
  const clientById = new Map(clients.map((c) => [c.id, c.name] as const));

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader title="Proyectos" description="Agrupación lógica de servicios y ambientes" />

      <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
        <Form method="post" className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
          <input type="hidden" name="intent" value={editing ? "update" : "create"} />
          {editing ? <input type="hidden" name="id" value={editing.id} /> : null}

          <Field label="Nombre" name="name" required defaultValue={editing?.name} />
          <Field label="Slug" name="slug" required placeholder="mi-proyecto" defaultValue={editing?.slug} />
          <Field label="Repo URL" name="repoUrl" type="url" defaultValue={editing?.repoUrl ?? ""} />
          <SelectField
            label="Cliente owner"
            name="ownerClientId"
            emptyLabel="— ninguno —"
            defaultValue={editing?.ownerClientId ?? ""}
            options={clientOptions}
          />
          <Field label="Color" name="colorHex" type="color" defaultValue={editing?.colorHex ?? "#6366f1"} />

          <div className="flex gap-2">
            <Button type="submit">{editing ? "Actualizar" : <><Plus className="size-3.5" />Crear</>}</Button>
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
              <th className="px-6 py-2 font-medium text-slate-700">Slug</th>
              <th className="px-6 py-2 font-medium text-slate-700">Cliente owner</th>
              <th className="px-6 py-2 font-medium text-slate-700">Repo</th>
              <th className="px-6 py-2 font-medium text-slate-700">Color</th>
              <th className="px-6 py-2 font-medium text-slate-700 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr><td colSpan={6} className="px-6 py-8 text-center text-slate-500">Sin proyectos. Crea el primero arriba.</td></tr>
            ) : null}
            {items.map((p) => (
              <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="px-6 py-2 font-medium">{p.name}</td>
                <td className="px-6 py-2 font-mono text-slate-600 text-xs">{p.slug}</td>
                <td className="px-6 py-2 text-slate-600">{p.ownerClientId ? clientById.get(p.ownerClientId) ?? "—" : "—"}</td>
                <td className="px-6 py-2 text-slate-600 truncate max-w-[200px]">{p.repoUrl ?? "—"}</td>
                <td className="px-6 py-2"><span className="inline-block size-5 rounded border border-slate-300" style={{ background: p.colorHex }} /></td>
                <td className="px-6 py-2 text-right">
                  <div className="inline-flex gap-1.5">
                    <a href={`/projects?edit=${p.id}`}>
                      <Button size="sm" variant="secondary"><Pencil className="size-3.5" /></Button>
                    </a>
                    <Form method="post" className="inline">
                      <input type="hidden" name="intent" value="delete" />
                      <input type="hidden" name="id" value={p.id} />
                      <Button size="sm" variant="danger" type="submit"
                        onClick={(e) => { if (!confirm(`¿Eliminar "${p.name}"?`)) e.preventDefault(); }}>
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
