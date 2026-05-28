import { type LoaderFunctionArgs, type ActionFunctionArgs, json, redirect } from "@remix-run/node";
import { Form, useFetcher, useLoaderData, useSearchParams } from "@remix-run/react";
import { ServerCog, Terminal, FileText, RefreshCw, Boxes, Trash2 } from "lucide-react";
import { api } from "~/lib/api.server";
import { requireUser } from "~/lib/auth.server";
import { PageHeader } from "~/components/ui/PageHeader";
import { Button } from "~/components/ui/Button";
import { ClientOnly } from "~/components/ClientOnly";
import { SshTerminal } from "~/components/terminal/SshTerminal";
import { LiveLogs } from "~/components/logs/LiveLogs";

type Tab = "overview" | "terminal" | "logs" | "containers";

interface ServerDetail {
  id: string;
  name: string;
  provider: string;
  region: string;
  publicIp?: string | null;
  privateIp?: string | null;
  os?: string | null;
  status: string;
  bootstrapStatus: string;
  costEstimate?: { monthlyUsd?: number; hourlyUsd?: number };
  specs?: { cpu?: number; ramMb?: number; diskGb?: number; instanceType?: string };
  ssh?: { user?: string; port?: number; keyId?: string };
  tags?: string[];
  cloudSourceId?: string;
  providerInstanceId?: string;
}

interface ContainerLite {
  id: string;
  containerId: string;
  name: string;
  image: string;
  state: string;
}

interface PlaybookLite {
  slug: string;
  name: string;
  description?: string | null;
  isBuiltin: boolean;
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  await requireUser(request);
  const id = params.serverId!;
  const [serverRes, containersRes, playbooksRes] = await Promise.all([
    api(request).get<ServerDetail>(`/api/v1/servers/${id}`),
    api(request).get<{ items: ContainerLite[] }>(`/api/v1/containers?serverId=${id}`),
    api(request).get<{ items: PlaybookLite[] }>(`/api/v1/playbooks`),
  ]);
  if (serverRes.status >= 400) throw new Response("Server no encontrado", { status: 404 });
  return json({
    server: serverRes.data,
    containers: containersRes.data?.items ?? [],
    playbooks: playbooksRes.data?.items ?? [],
  });
}

export async function action({ request, params }: ActionFunctionArgs) {
  await requireUser(request);
  const id = params.serverId!;
  const form = await request.formData();
  const intent = String(form.get("intent") ?? "");
  const client = api(request);

  if (intent === "sync-containers") {
    const res = await client.post(`/api/v1/servers/${id}/sync-containers`);
    return json({ syncResult: res.data, error: res.status >= 400 ? res.data?.error?.message : null });
  }
  if (intent === "ssh-test") {
    const res = await client.post(`/api/v1/servers/${id}/ssh/test`);
    return json({ sshTest: res.data, error: res.status >= 400 ? res.data?.error?.message : null });
  }
  if (intent === "assign-ssh-key") {
    const keyId = String(form.get("sshKeyId") ?? "");
    await client.patch(`/api/v1/servers/${id}`, { ssh: { user: form.get("sshUser") ?? "root", port: Number(form.get("sshPort") ?? 22), keyId } });
    return redirect(`/servers/${id}`);
  }
  if (intent === "run-playbook") {
    const slug = String(form.get("playbookSlug") ?? "");
    const res = await client.post(`/api/v1/playbooks/${slug}/run-on/${id}`);
    return json({ runResult: res.data, error: res.status >= 400 ? res.data?.error?.message : null });
  }
  if (intent === "terminate") {
    const res = await client.post(`/api/v1/servers/${id}/terminate?force=1`);
    if (res.status >= 400) return json({ error: res.data?.error?.message }, { status: 400 });
    return redirect("/servers");
  }
  return null;
}

export default function ServerDetailRoute() {
  const { server, containers, playbooks } = useLoaderData<typeof loader>();
  const [params, setParams] = useSearchParams();
  const tab = (params.get("tab") as Tab) ?? "overview";

  const switchTab = (t: Tab) => {
    const next = new URLSearchParams(params);
    next.set("tab", t);
    setParams(next);
  };

  const tabs: { id: Tab; label: string; icon: typeof Terminal }[] = [
    { id: "overview", label: "Overview", icon: ServerCog },
    { id: "containers", label: "Containers", icon: Boxes },
    { id: "terminal", label: "Terminal", icon: Terminal },
    { id: "logs", label: "Logs", icon: FileText },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader
        title={server.name}
        description={`${server.provider.toUpperCase()} · ${server.region} · ${server.publicIp ?? "sin IP"}`}
        actions={
          <Form method="post">
            <input type="hidden" name="intent" value="terminate" />
            <Button size="sm" variant="danger" type="submit"
              onClick={(e) => { if (!confirm(`¿Destruir VM "${server.name}" en el provider?`)) e.preventDefault(); }}>
              <Trash2 className="size-3.5" /> Terminate
            </Button>
          </Form>
        }
      />

      <nav className="px-6 border-b border-slate-200 bg-white flex gap-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => switchTab(t.id)}
            className={
              tab === t.id
                ? "px-3 py-2 border-b-2 border-brand-600 text-brand-700 font-medium text-sm flex items-center gap-2"
                : "px-3 py-2 border-b-2 border-transparent text-slate-600 hover:text-slate-900 text-sm flex items-center gap-2"
            }
          >
            <t.icon className="size-4" />
            {t.label}
          </button>
        ))}
      </nav>

      <div className="flex-1 min-h-0 overflow-hidden">
        {tab === "overview" ? <OverviewTab server={server} playbooks={playbooks} /> : null}
        {tab === "containers" ? <ContainersTab containers={containers} /> : null}
        {tab === "terminal" ? (
          <ClientOnly fallback={<div className="p-6 text-slate-500">Inicializando terminal...</div>}>
            {() => <SshTerminal serverId={server.id} />}
          </ClientOnly>
        ) : null}
        {tab === "logs" ? (
          <ClientOnly fallback={<div className="p-6 text-slate-500">Inicializando stream...</div>}>
            {() => <LiveLogs serverId={server.id} />}
          </ClientOnly>
        ) : null}
      </div>
    </div>
  );
}

function OverviewTab({ server, playbooks }: { server: ServerDetail; playbooks: PlaybookLite[] }) {
  const syncFetcher = useFetcher<any>();
  const sshTestFetcher = useFetcher<any>();
  const runFetcher = useFetcher<any>();

  return (
    <div className="p-6 space-y-6 overflow-auto h-full">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card title="Información">
          <Row k="ID" v={<code className="text-xs">{server.id}</code>} />
          <Row k="Provider Instance ID" v={server.providerInstanceId ?? "—"} />
          <Row k="Status" v={<Pill label={server.status} />} />
          <Row k="Bootstrap" v={server.bootstrapStatus} />
          <Row k="OS" v={server.os ?? "—"} />
          <Row k="IP pública" v={server.publicIp ?? "—"} />
          <Row k="IP privada" v={server.privateIp ?? "—"} />
        </Card>

        <Card title="Recursos">
          <Row k="Instance Type" v={server.specs?.instanceType ?? "—"} />
          <Row k="CPU" v={server.specs?.cpu ?? "—"} />
          <Row k="RAM" v={server.specs?.ramMb ? `${server.specs.ramMb} MB` : "—"} />
          <Row k="Disco" v={server.specs?.diskGb ? `${server.specs.diskGb} GB` : "—"} />
          <Row k="Costo/h" v={server.costEstimate?.hourlyUsd != null ? `$${server.costEstimate.hourlyUsd}` : "—"} />
          <Row k="Costo/mes" v={server.costEstimate?.monthlyUsd != null ? `$${server.costEstimate.monthlyUsd}` : "—"} />
        </Card>
      </div>

      <Card title="Acciones rápidas">
        <div className="flex flex-wrap gap-2">
          <syncFetcher.Form method="post">
            <input type="hidden" name="intent" value="sync-containers" />
            <Button size="sm" type="submit" disabled={syncFetcher.state !== "idle"}>
              <RefreshCw className="size-3.5" />
              {syncFetcher.state !== "idle" ? "Sincronizando..." : "Sync containers"}
            </Button>
          </syncFetcher.Form>
          <sshTestFetcher.Form method="post">
            <input type="hidden" name="intent" value="ssh-test" />
            <Button size="sm" variant="secondary" type="submit" disabled={sshTestFetcher.state !== "idle"}>
              {sshTestFetcher.state !== "idle" ? "Probando..." : "SSH test (uname -a)"}
            </Button>
          </sshTestFetcher.Form>
        </div>
        {syncFetcher.data?.syncResult ? (
          <div className="mt-2 text-xs text-emerald-700">
            ✓ {syncFetcher.data.syncResult.synced} containers sincronizados ({syncFetcher.data.syncResult.added} nuevos)
          </div>
        ) : null}
        {syncFetcher.data?.error ? (
          <div className="mt-2 text-xs text-red-700">✗ {syncFetcher.data.error}</div>
        ) : null}
        {sshTestFetcher.data?.sshTest ? (
          <pre className="mt-2 text-xs bg-slate-900 text-emerald-300 p-2 rounded overflow-auto max-h-32">
            {sshTestFetcher.data.sshTest.stdout || sshTestFetcher.data.sshTest.stderr || "(sin output)"}
          </pre>
        ) : null}
        {sshTestFetcher.data?.error ? (
          <div className="mt-2 text-xs text-red-700">✗ {sshTestFetcher.data.error}</div>
        ) : null}
      </Card>

      <Card title="Configuración SSH">
        <Form method="post" className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end text-sm">
          <input type="hidden" name="intent" value="assign-ssh-key" />
          <label className="block">
            <span className="block font-medium text-slate-700 mb-1">Usuario</span>
            <input name="sshUser" defaultValue={server.ssh?.user ?? "root"}
              className="w-full rounded-md border border-slate-300 px-3 py-1.5" />
          </label>
          <label className="block">
            <span className="block font-medium text-slate-700 mb-1">Puerto</span>
            <input type="number" name="sshPort" defaultValue={server.ssh?.port ?? 22}
              className="w-full rounded-md border border-slate-300 px-3 py-1.5" />
          </label>
          <label className="block md:col-span-2">
            <span className="block font-medium text-slate-700 mb-1">SSH Key ID</span>
            <input name="sshKeyId" defaultValue={server.ssh?.keyId ?? ""} placeholder="UUID de SshKey"
              className="w-full rounded-md border border-slate-300 px-3 py-1.5 font-mono text-xs" />
          </label>
          <Button size="sm" type="submit">Guardar SSH</Button>
        </Form>
        <p className="text-xs text-slate-500 mt-2">
          Para crear/listar SSH keys ve a <a href="/settings/ssh-keys" className="text-brand-600 underline">Settings → SSH Keys</a>.
        </p>
      </Card>

      <Card title="Ejecutar playbook">
        <runFetcher.Form method="post" className="flex items-end gap-2">
          <input type="hidden" name="intent" value="run-playbook" />
          <label className="flex-1 block text-sm">
            <span className="block font-medium text-slate-700 mb-1">Playbook</span>
            <select name="playbookSlug" required className="w-full rounded-md border border-slate-300 px-3 py-1.5 bg-white">
              {playbooks.map((p) => (
                <option key={p.slug} value={p.slug}>
                  {p.name} {p.isBuiltin ? "(built-in)" : ""}
                </option>
              ))}
            </select>
          </label>
          <Button size="sm" type="submit" disabled={runFetcher.state !== "idle"}>
            {runFetcher.state !== "idle" ? "Lanzando..." : "Ejecutar"}
          </Button>
        </runFetcher.Form>
        {runFetcher.data?.runResult ? (
          <div className="mt-2 text-xs text-emerald-700">
            ✓ Run iniciado · runId: <code>{runFetcher.data.runResult.runId}</code>
          </div>
        ) : null}
        {runFetcher.data?.error ? (
          <div className="mt-2 text-xs text-red-700">✗ {runFetcher.data.error}</div>
        ) : null}
      </Card>
    </div>
  );
}

function ContainersTab({ containers }: { containers: ContainerLite[] }) {
  return (
    <div className="overflow-auto h-full">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
          <tr className="text-left">
            <th className="px-6 py-2 font-medium">Nombre</th>
            <th className="px-6 py-2 font-medium">Imagen</th>
            <th className="px-6 py-2 font-medium">Estado</th>
            <th className="px-6 py-2 font-medium">Container ID</th>
          </tr>
        </thead>
        <tbody>
          {containers.length === 0 ? (
            <tr><td colSpan={4} className="px-6 py-8 text-center text-slate-500">Sin containers en este server. Usa <strong>Sync containers</strong> en Overview.</td></tr>
          ) : null}
          {containers.map((c) => (
            <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50">
              <td className="px-6 py-2 font-medium">{c.name}</td>
              <td className="px-6 py-2 font-mono text-xs">{c.image}</td>
              <td className="px-6 py-2">
                <span className={c.state === "running" ? "text-emerald-700" : "text-slate-500"}>{c.state}</span>
              </td>
              <td className="px-6 py-2 font-mono text-xs text-slate-500">{c.containerId.slice(0, 12)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-slate-700 mb-3">{title}</h3>
      {children}
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between py-1 text-sm border-b border-slate-100 last:border-0">
      <span className="text-slate-600">{k}</span>
      <span className="text-slate-900 text-right">{v}</span>
    </div>
  );
}

function Pill({ label }: { label: string }) {
  const colors: Record<string, string> = {
    running: "bg-emerald-100 text-emerald-700",
    stopped: "bg-slate-100 text-slate-700",
    provisioning: "bg-amber-100 text-amber-700",
    error: "bg-red-100 text-red-700",
    terminated: "bg-slate-200 text-slate-500",
  };
  return <span className={`inline-block px-2 py-0.5 rounded text-xs ${colors[label] ?? "bg-slate-100"}`}>{label}</span>;
}
