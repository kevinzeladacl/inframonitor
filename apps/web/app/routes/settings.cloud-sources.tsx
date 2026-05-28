import {
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
  type MetaFunction,
  json,
  redirect,
} from "@remix-run/node";
import {
  Form,
  useActionData,
  useFetcher,
  useLoaderData,
  useSearchParams,
} from "@remix-run/react";
import { Trash2, Pencil, Plus, X, ShieldCheck, Download, AlertTriangle, CheckCircle2 } from "lucide-react";
import { api } from "~/lib/api.server";
import { requireUser } from "~/lib/auth.server";
import { PageHeader } from "~/components/ui/PageHeader";
import { Field, SelectField } from "~/components/ui/Field";
import { Button } from "~/components/ui/Button";

export const meta: MetaFunction = () => [{ title: "Cloud Sources · Inframonitor" }];

type Provider = "aws" | "digitalocean" | "azure";

interface CloudSource {
  id: string;
  name: string;
  provider: Provider;
  defaultRegion?: string | null;
  verifiedAt?: string | null;
  lastError?: string | null;
  enabled: boolean;
}

const PROVIDER_OPTIONS = [
  { value: "digitalocean", label: "DigitalOcean" },
  { value: "aws", label: "AWS" },
  { value: "azure", label: "Azure" },
];

export async function loader({ request }: LoaderFunctionArgs) {
  await requireUser(request);
  const res = await api(request).get<{ items: CloudSource[] }>("/api/v1/cloud-sources");
  return json({ items: res.data?.items ?? [] });
}

export async function action({ request }: ActionFunctionArgs) {
  await requireUser(request);
  const form = await request.formData();
  const intent = String(form.get("intent") ?? "");
  const id = String(form.get("id") ?? "");
  const client = api(request);

  if (intent === "create") {
    const provider = form.get("provider") as Provider;
    let credentials: Record<string, string> = { provider };
    if (provider === "aws") {
      credentials.accessKeyId = String(form.get("accessKeyId") ?? "");
      credentials.secretAccessKey = String(form.get("secretAccessKey") ?? "");
      credentials.defaultRegion = String(form.get("defaultRegion") ?? "us-east-1");
    } else if (provider === "digitalocean") {
      credentials.token = String(form.get("token") ?? "");
    } else if (provider === "azure") {
      credentials.tenantId = String(form.get("tenantId") ?? "");
      credentials.clientId = String(form.get("clientId") ?? "");
      credentials.clientSecret = String(form.get("clientSecret") ?? "");
      credentials.subscriptionId = String(form.get("subscriptionId") ?? "");
    }
    const body = {
      name: String(form.get("name") ?? ""),
      provider,
      defaultRegion: String(form.get("defaultRegion") ?? "") || null,
      enabled: true,
      credentials,
    };
    const res = await client.post("/api/v1/cloud-sources", body);
    if (res.status >= 400) return json({ error: res.data?.error?.message ?? "Error al crear", details: res.data }, { status: 400 });
    return redirect("/settings/cloud-sources");
  }

  if (intent === "delete") {
    const res = await client.delete(`/api/v1/cloud-sources/${id}`);
    if (res.status >= 400) return json({ error: res.data?.error?.message ?? "Error al eliminar" }, { status: 400 });
    return redirect("/settings/cloud-sources");
  }

  if (intent === "verify") {
    const res = await client.post(`/api/v1/cloud-sources/${id}/verify`);
    return json({ verify: res.data });
  }

  if (intent === "import") {
    const res = await client.post(`/api/v1/cloud-sources/${id}/import-servers`);
    if (res.status >= 400) return json({ error: res.data?.error?.message ?? "Import falló" }, { status: 400 });
    return json({ import: res.data });
  }

  return json({ error: "intent inválido" }, { status: 400 });
}

export default function CloudSourcesRoute() {
  const { items } = useLoaderData<typeof loader>();
  const [params] = useSearchParams();
  const provider = (params.get("provider") as Provider) ?? "digitalocean";
  const actionData = useActionData<typeof action>();

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader
        title="Cloud Sources"
        description="Cuentas cloud (AWS, DigitalOcean, Azure). Credenciales cifradas con libsodium en reposo."
      />

      <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
        <h2 className="text-sm font-semibold text-slate-700 mb-3">Agregar nueva</h2>

        {/* Selector de provider — cambia el form sin perder los valores entre vueltas */}
        <div className="flex gap-2 mb-3">
          {PROVIDER_OPTIONS.map((o) => (
            <a key={o.value} href={`?provider=${o.value}`}>
              <Button
                type="button"
                variant={provider === o.value ? "primary" : "secondary"}
                size="sm"
              >
                {o.label}
              </Button>
            </a>
          ))}
        </div>

        <Form method="post" className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <input type="hidden" name="intent" value="create" />
          <input type="hidden" name="provider" value={provider} />

          <Field label="Nombre" name="name" required placeholder="AWS Personal · DO Prod · etc." />

          {provider === "digitalocean" ? (
            <Field label="Token (dop_v1_xxx)" name="token" required placeholder="dop_v1_…" className="md:col-span-2" />
          ) : null}

          {provider === "aws" ? (
            <>
              <Field label="Access Key ID" name="accessKeyId" required placeholder="AKIA…" />
              <Field label="Secret Access Key" name="secretAccessKey" required />
              <Field label="Región" name="defaultRegion" required defaultValue="us-east-1" placeholder="us-east-1" />
            </>
          ) : null}

          {provider === "azure" ? (
            <>
              <Field label="Tenant ID" name="tenantId" required />
              <Field label="Client ID" name="clientId" required />
              <Field label="Client Secret" name="clientSecret" required />
              <Field label="Subscription ID" name="subscriptionId" required />
            </>
          ) : null}

          <Button type="submit"><Plus className="size-3.5" /> Crear</Button>
        </Form>

        {actionData && "error" in actionData && actionData.error ? (
          <div className="mt-3 text-sm text-red-700">
            {actionData.error}
            {actionData.details ? (
              <pre className="text-xs bg-red-50 p-2 rounded mt-1">{JSON.stringify(actionData.details, null, 2)}</pre>
            ) : null}
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
              <th className="px-6 py-2 font-medium text-slate-700">Estado</th>
              <th className="px-6 py-2 font-medium text-slate-700 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-500">Sin Cloud Sources.</td></tr>
            ) : null}
            {items.map((cs) => <CloudSourceRow key={cs.id} cs={cs} />)}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CloudSourceRow({ cs }: { cs: CloudSource }) {
  const verifyFetcher = useFetcher<typeof action>();
  const importFetcher = useFetcher<typeof action>();
  const verifyData = (verifyFetcher.data as any)?.verify;
  const importData = (importFetcher.data as any)?.import;

  return (
    <tr className="border-b border-slate-100 hover:bg-slate-50 align-top">
      <td className="px-6 py-3 font-medium">{cs.name}</td>
      <td className="px-6 py-3 uppercase text-xs text-slate-600">{cs.provider}</td>
      <td className="px-6 py-3 text-slate-600">{cs.defaultRegion ?? "—"}</td>
      <td className="px-6 py-3 text-sm">
        {cs.verifiedAt ? (
          <span className="inline-flex items-center gap-1 text-emerald-700">
            <CheckCircle2 className="size-3.5" /> Verificada
          </span>
        ) : cs.lastError ? (
          <span className="inline-flex items-center gap-1 text-red-700" title={cs.lastError}>
            <AlertTriangle className="size-3.5" /> Error
          </span>
        ) : (
          <span className="text-slate-500">Sin verificar</span>
        )}
        {verifyData ? (
          <div className={`mt-1 text-xs ${verifyData.ok ? "text-emerald-700" : "text-red-700"}`}>
            {verifyData.ok ? `OK: ${verifyData.identity}` : verifyData.error}
          </div>
        ) : null}
        {importData ? (
          <div className="mt-1 text-xs text-brand-700">
            Importados: {importData.imported}, actualizados: {importData.updated}
          </div>
        ) : null}
      </td>
      <td className="px-6 py-3 text-right">
        <div className="inline-flex gap-1.5 flex-wrap justify-end">
          <verifyFetcher.Form method="post">
            <input type="hidden" name="intent" value="verify" />
            <input type="hidden" name="id" value={cs.id} />
            <Button size="sm" variant="secondary" type="submit" disabled={verifyFetcher.state !== "idle"}>
              <ShieldCheck className="size-3.5" />
              {verifyFetcher.state !== "idle" ? "Verificando…" : "Verificar"}
            </Button>
          </verifyFetcher.Form>
          <importFetcher.Form method="post">
            <input type="hidden" name="intent" value="import" />
            <input type="hidden" name="id" value={cs.id} />
            <Button size="sm" variant="secondary" type="submit" disabled={importFetcher.state !== "idle"}>
              <Download className="size-3.5" />
              {importFetcher.state !== "idle" ? "Importando…" : "Importar VMs"}
            </Button>
          </importFetcher.Form>
          <Form method="post" className="inline">
            <input type="hidden" name="intent" value="delete" />
            <input type="hidden" name="id" value={cs.id} />
            <Button size="sm" variant="danger" type="submit"
              onClick={(e) => { if (!confirm(`¿Eliminar "${cs.name}"? Los servidores asociados NO se borran.`)) e.preventDefault(); }}>
              <Trash2 className="size-3.5" />
            </Button>
          </Form>
        </div>
      </td>
    </tr>
  );
}
