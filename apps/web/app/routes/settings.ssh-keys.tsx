import {
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
  type MetaFunction,
  json,
  redirect,
} from "@remix-run/node";
import { Form, useActionData, useLoaderData } from "@remix-run/react";
import { Trash2, Plus, Key } from "lucide-react";
import { api } from "~/lib/api.server";
import { requireUser } from "~/lib/auth.server";
import { PageHeader } from "~/components/ui/PageHeader";
import { Field } from "~/components/ui/Field";
import { Button } from "~/components/ui/Button";

export const meta: MetaFunction = () => [{ title: "SSH Keys · Inframonitor" }];

interface SshKey {
  id: string;
  name: string;
  publicKey: string;
  fingerprint: string;
  createdAt: string;
}

export async function loader({ request }: LoaderFunctionArgs) {
  await requireUser(request);
  const res = await api(request).get<{ items: SshKey[] }>("/api/v1/ssh-keys");
  return json({ items: res.data?.items ?? [] });
}

export async function action({ request }: ActionFunctionArgs) {
  await requireUser(request);
  const form = await request.formData();
  const intent = String(form.get("intent") ?? "");
  if (intent === "create") {
    const res = await api(request).post("/api/v1/ssh-keys", { name: form.get("name") });
    if (res.status >= 400) return json({ error: res.data?.error?.message ?? "Error" }, { status: 400 });
    return redirect("/settings/ssh-keys");
  }
  if (intent === "delete") {
    await api(request).delete(`/api/v1/ssh-keys/${form.get("id")}`);
    return redirect("/settings/ssh-keys");
  }
  return null;
}

export default function SshKeysRoute() {
  const { items } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader
        title="SSH Keys"
        description="Llaves ED25519 generadas en la app. La privada se cifra con libsodium y nunca sale por API."
      />

      <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
        <Form method="post" className="flex items-end gap-3 max-w-md">
          <input type="hidden" name="intent" value="create" />
          <Field label="Nombre" name="name" required placeholder="produccion-main" className="flex-1" />
          <Button type="submit"><Plus className="size-3.5" /> Generar</Button>
        </Form>
        {actionData && "error" in actionData && actionData.error ? (
          <div className="mt-3 text-sm text-red-700">{actionData.error}</div>
        ) : null}
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-3">
        {items.length === 0 ? (
          <div className="text-center text-slate-500 py-8">Sin llaves. Genera la primera.</div>
        ) : null}
        {items.map((k) => (
          <div key={k.id} className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex items-start justify-between gap-4 mb-2">
              <div>
                <div className="font-medium flex items-center gap-2">
                  <Key className="size-4 text-brand-600" /> {k.name}
                </div>
                <div className="text-xs text-slate-500 font-mono mt-0.5">{k.fingerprint}</div>
              </div>
              <Form method="post">
                <input type="hidden" name="intent" value="delete" />
                <input type="hidden" name="id" value={k.id} />
                <Button size="sm" variant="danger" type="submit"
                  onClick={(e) => { if (!confirm(`¿Eliminar llave "${k.name}"?`)) e.preventDefault(); }}>
                  <Trash2 className="size-3.5" />
                </Button>
              </Form>
            </div>
            <details className="text-xs">
              <summary className="cursor-pointer text-slate-600 hover:text-slate-900">Ver llave pública (copiar a authorized_keys)</summary>
              <textarea
                readOnly
                value={k.publicKey}
                className="mt-2 w-full font-mono text-[10px] bg-slate-50 border border-slate-200 rounded p-2 h-20"
                onClick={(e) => (e.target as HTMLTextAreaElement).select()}
              />
            </details>
          </div>
        ))}
      </div>
    </div>
  );
}
