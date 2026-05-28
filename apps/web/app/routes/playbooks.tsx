import { type LoaderFunctionArgs, type ActionFunctionArgs, type MetaFunction, json, redirect } from "@remix-run/node";
import { Form, useActionData, useLoaderData, useSearchParams } from "@remix-run/react";
import { Trash2, Pencil, Plus, ScrollText } from "lucide-react";
import yaml from "yaml";
import { api } from "~/lib/api.server";
import { requireUser } from "~/lib/auth.server";
import { PageHeader } from "~/components/ui/PageHeader";
import { Field } from "~/components/ui/Field";
import { Button } from "~/components/ui/Button";

export const meta: MetaFunction = () => [{ title: "Playbooks · Inframonitor" }];

interface PlaybookStep {
  name: string;
  command: string;
  expectedExitCode?: number;
  timeoutSec?: number;
  continueOnError?: boolean;
}
interface Playbook {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  kind: "shell" | "compose" | "composite";
  steps: PlaybookStep[];
  version: number;
  isBuiltin: boolean;
}

export async function loader({ request }: LoaderFunctionArgs) {
  await requireUser(request);
  const res = await api(request).get<{ items: Playbook[] }>("/api/v1/playbooks");
  return json({ items: res.data?.items ?? [] });
}

export async function action({ request }: ActionFunctionArgs) {
  await requireUser(request);
  const form = await request.formData();
  const intent = String(form.get("intent") ?? "");
  const client = api(request);

  if (intent === "create" || intent === "update") {
    const stepsYaml = String(form.get("stepsYaml") ?? "");
    let steps: PlaybookStep[];
    try {
      steps = yaml.parse(stepsYaml) ?? [];
      if (!Array.isArray(steps)) throw new Error("steps debe ser una lista YAML");
    } catch (err: any) {
      return json({ error: `YAML inválido: ${err?.message}` }, { status: 400 });
    }
    const body = {
      name: String(form.get("name") ?? ""),
      slug: String(form.get("slug") ?? ""),
      description: String(form.get("description") ?? "") || null,
      kind: (form.get("kind") as "shell") ?? "shell",
      steps,
    };
    const res = intent === "create"
      ? await client.post("/api/v1/playbooks", body)
      : await client.patch(`/api/v1/playbooks/${form.get("slug")}`, body);
    if (res.status >= 400) return json({ error: res.data?.error?.message ?? "Error" }, { status: 400 });
    return redirect("/playbooks");
  }

  if (intent === "delete") {
    const slug = String(form.get("slug") ?? "");
    const res = await client.delete(`/api/v1/playbooks/${slug}`);
    if (res.status >= 400) return json({ error: res.data?.error?.message ?? "Error" }, { status: 400 });
    return redirect("/playbooks");
  }
  return null;
}

const SAMPLE = `- name: Saludar
  command: echo "Hola desde el playbook"
  timeoutSec: 5
- name: Mostrar fecha
  command: date
  timeoutSec: 5
`;

export default function PlaybooksRoute() {
  const { items } = useLoaderData<typeof loader>();
  const [params] = useSearchParams();
  const editSlug = params.get("edit");
  const editing = items.find((p) => p.slug === editSlug);
  const actionData = useActionData<typeof action>();

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader
        title="Playbooks"
        description="Recetas YAML que se ejecutan paso a paso por SSH. Built-in seedeados; custom editables."
      />

      <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
        <h2 className="text-sm font-semibold text-slate-700 mb-3">
          {editing ? `Editando: ${editing.name}` : "Nuevo playbook"}
        </h2>
        <Form method="post" className="space-y-3">
          <input type="hidden" name="intent" value={editing ? "update" : "create"} />
          {editing ? <input type="hidden" name="slug" value={editing.slug} /> : null}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Field label="Nombre" name="name" required defaultValue={editing?.name} placeholder="Bootstrap Node.js" />
            <Field label="Slug" name="slug" required defaultValue={editing?.slug} placeholder="node-bootstrap" />
            <Field label="Descripción" name="description" defaultValue={editing?.description ?? ""} />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Steps (YAML)</label>
            <textarea
              name="stepsYaml"
              required
              rows={10}
              defaultValue={editing ? yaml.stringify(editing.steps) : SAMPLE}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-mono"
            />
            <p className="text-xs text-slate-500 mt-1">
              Cada step: <code>name</code>, <code>command</code>, opcionales <code>timeoutSec</code>, <code>expectedExitCode</code>, <code>continueOnError</code>.
            </p>
          </div>

          <div className="flex gap-2">
            <Button type="submit"><Plus className="size-3.5" />{editing ? "Actualizar" : "Crear"}</Button>
            {editing ? (
              <Button type="button" variant="secondary" onClick={() => (window.location.search = "")}>Cancelar</Button>
            ) : null}
          </div>
        </Form>
        {actionData && "error" in actionData && actionData.error ? (
          <div className="mt-3 text-sm text-red-700">{actionData.error}</div>
        ) : null}
      </div>

      <div className="flex-1 overflow-auto p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((p) => (
          <div key={p.slug} className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex items-start justify-between mb-2">
              <div>
                <div className="flex items-center gap-2">
                  <ScrollText className="size-4 text-brand-600" />
                  <div className="font-semibold">{p.name}</div>
                  {p.isBuiltin ? (
                    <span className="text-[10px] uppercase bg-brand-100 text-brand-700 px-1.5 py-0.5 rounded">Built-in</span>
                  ) : null}
                </div>
                <div className="text-xs text-slate-500 font-mono">/{p.slug} · v{p.version}</div>
              </div>
              {!p.isBuiltin ? (
                <div className="flex gap-1">
                  <a href={`/playbooks?edit=${p.slug}`}>
                    <Button size="sm" variant="secondary"><Pencil className="size-3.5" /></Button>
                  </a>
                  <Form method="post" className="inline">
                    <input type="hidden" name="intent" value="delete" />
                    <input type="hidden" name="slug" value={p.slug} />
                    <Button size="sm" variant="danger" type="submit"
                      onClick={(e) => { if (!confirm(`¿Eliminar "${p.name}"?`)) e.preventDefault(); }}>
                      <Trash2 className="size-3.5" />
                    </Button>
                  </Form>
                </div>
              ) : null}
            </div>
            {p.description ? <p className="text-sm text-slate-700 mb-2">{p.description}</p> : null}
            <div className="text-xs text-slate-500">{p.steps.length} step{p.steps.length === 1 ? "" : "s"}</div>
            <details className="mt-2">
              <summary className="cursor-pointer text-xs text-slate-600 hover:text-slate-900">Ver pasos</summary>
              <pre className="text-[10px] mt-2 bg-slate-50 p-2 rounded border border-slate-200 overflow-auto max-h-40">
                {yaml.stringify(p.steps)}
              </pre>
            </details>
          </div>
        ))}
      </div>
    </div>
  );
}
