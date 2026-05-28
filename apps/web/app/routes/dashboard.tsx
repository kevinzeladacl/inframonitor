import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json, useLoaderData, Link } from "@remix-run/react";
import { api } from "~/lib/api.server";
import { requireUser } from "~/lib/auth.server";
import { PageHeader } from "~/components/ui/PageHeader";

export const meta: MetaFunction = () => [{ title: "Dashboard · Inframonitor" }];

export async function loader({ request }: LoaderFunctionArgs) {
  await requireUser(request);
  const [servers, containers, clients, projects] = await Promise.all([
    api(request).get<{ items: any[] }>("/api/v1/servers"),
    api(request).get<{ items: any[] }>("/api/v1/containers"),
    api(request).get<{ items: any[] }>("/api/v1/clients"),
    api(request).get<{ items: any[] }>("/api/v1/projects"),
  ]);
  const serversList = servers.data?.items ?? [];
  const containersList = containers.data?.items ?? [];
  const runningCount = containersList.filter((c: any) => c.state === "running").length;
  const monthlyCost = serversList.reduce(
    (acc: number, s: any) => acc + (Number(s.costEstimate?.monthlyUsd) || 0),
    0
  );
  return json({
    counts: {
      servers: serversList.length,
      containers: containersList.length,
      containersRunning: runningCount,
      clients: clients.data?.items?.length ?? 0,
      projects: projects.data?.items?.length ?? 0,
    },
    monthlyCost,
  });
}

export default function DashboardRoute() {
  const { counts, monthlyCost } = useLoaderData<typeof loader>();
  const cards = [
    { label: "Servidores", value: counts.servers, hint: "Total registrados", to: "/servers" },
    { label: "Costo mensual", value: `$${monthlyCost.toFixed(2)}`, hint: "Suma estimada", to: "/servers" },
    { label: "Contenedores corriendo", value: `${counts.containersRunning}/${counts.containers}`, hint: "Estado real", to: "/containers" },
    { label: "Clientes", value: counts.clients, hint: "Deploys configurados", to: "/clientes-admin" },
    { label: "Proyectos", value: counts.projects, hint: "Servicios definidos", to: "/projects" },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader title="Dashboard" description="Resumen global de tu infraestructura" />
      <div className="flex-1 overflow-auto p-6 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {cards.map((c) => (
            <Link
              key={c.label}
              to={c.to}
              className="rounded-lg border border-slate-200 bg-white p-4 hover:border-brand-300 hover:shadow-sm transition"
            >
              <div className="text-xs uppercase tracking-wide text-slate-500">{c.label}</div>
              <div className="text-2xl font-bold mt-1 text-slate-900">{c.value}</div>
              <div className="text-xs text-slate-500 mt-1">{c.hint}</div>
            </Link>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Link to="/infraestructura" className="rounded-lg border border-slate-200 bg-white p-6 hover:border-brand-300 transition">
            <h3 className="text-lg font-semibold">Vista de Infraestructura →</h3>
            <p className="text-sm text-slate-500 mt-1">Mapa técnico: Servidor → Container → Ambiente → Proyecto</p>
          </Link>
          <Link to="/clientes" className="rounded-lg border border-slate-200 bg-white p-6 hover:border-brand-300 transition">
            <h3 className="text-lg font-semibold">Vista por Cliente →</h3>
            <p className="text-sm text-slate-500 mt-1">Qué servidores usa cada deploy</p>
          </Link>
        </div>

        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <strong>Fase 2 activa.</strong> Auth real + CRUD UI completo. Próximas: Cloud Sources reales (Fase 3),
          terminal SSH (Fase 4), logs streaming (Fase 5), playbooks (Fase 6), wizard provisioning (Fase 7).
        </div>
      </div>
    </div>
  );
}
