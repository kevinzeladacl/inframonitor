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

export const meta: MetaFunction = () => [{ title: "Ambientes · Inframonitor" }];

interface EnvironmentItem {
  id: string;
  name: "dev" | "staging" | "prod" | "qa";
  projectId: string;
  urlBase?: string | null;
}
interface ProjectLite { id: string; name: string }

const ENV_OPTIONS = [
  { value: "dev", label: "dev" },
  { value: "staging", label: "staging" },
  { value: "qa", label: "qa" },
  { value: "prod", label: "prod" },
];

export async function loader({ request }: LoaderFunctionArgs) {
  await requireUser(request);
  const [envs, projects] = await Promise.all([
    api(request).get<{ items: EnvironmentItem[] }>("/api/v1/environments"),
    api(request).get<{ items: ProjectLite[] }>("/api/v1/projects"),
  ]);
  return json({
    items: envs.data?.items ?? [],
    projects: projects.data?.items ?? [],
  });
}

export async function action({ request }: ActionFunctionArgs) {
  await requireUser(request);
  const form = await request.formData();
  const result = await handleCrudAction(request, "/api/v1/environments", form);
  if (result.ok) return redirect("/environments");
  return json(result, { status: 400 });
}

export default function EnvironmentsRoute() {
  const { items, projects } = useLoaderData<typeof loader>();
  const [params] = useSearchParams();
  const editingId = params.get("edit");
  const editing = items.find((i) => i.id === editingId);
  const actionData = useActionData<typeof action>();

  const projectOptions = projects.map((p) => ({ value: p.id, label: p.name }));
  const projectById = new Map(projects.map((p) => [p.id, p.name] as const));

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader title="Ambientes" description="dev / staging / prod / qa por proyecto" />

      <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
        <Form method="post" className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
          <input type="hidden" name="intent" value={editing ? "update" : "create"} />
          {editing ? <input type="hidden" name="id" value={editing.id} /> : null}

          <SelectField label="Nombre" name="name" defaultValue={editing?.name ?? "prod"} options={ENV_OPTIONS} required />
          <SelectField label="Proyecto" name="projectId" defaultValue={editing?.projectId} options={projectOptions} required />
          <Field label="URL base" name="urlBase" type="url" defaultValue={editing?.urlBase ?? ""} placeholder="https://prod.example.com" className="md:col-span-2" />

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
              <th className="px-6 py-2 font-medium text-slate-700">Ambiente</th>
              <th className="px-6 py-2 font-medium text-slate-700">Proyecto</th>
              <th className="px-6 py-2 font-medium text-slate-700">URL base</th>
              <th className="px-6 py-2 font-medium text-slate-700 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr><td colSpan={4} className="px-6 py-8 text-center text-slate-500">Sin ambientes.</td></tr>
            ) : null}
            {items.map((e) => (
              <tr key={e.id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="px-6 py-2 font-mono uppercase">{e.name}</td>
                <td className="px-6 py-2">{projectById.get(e.projectId) ?? e.projectId}</td>
                <td className="px-6 py-2 text-slate-600 truncate max-w-[300px]">{e.urlBase ?? "—"}</td>
                <td className="px-6 py-2 text-right">
                  <div className="inline-flex gap-1.5">
                    <a href={`/environments?edit=${e.id}`}>
                      <Button size="sm" variant="secondary"><Pencil className="size-3.5" /></Button>
                    </a>
                    <Form method="post" className="inline">
                      <input type="hidden" name="intent" value="delete" />
                      <input type="hidden" name="id" value={e.id} />
                      <Button size="sm" variant="danger" type="submit"
                        onClick={(ev) => { if (!confirm(`¿Eliminar ambiente "${e.name}"?`)) ev.preventDefault(); }}>
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
