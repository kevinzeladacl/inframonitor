import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json, isRouteErrorResponse, useLoaderData, useRouteError } from "@remix-run/react";
import type { TopologyGraph } from "@inframonitor/shared-types";
import { api } from "~/lib/api.server";
import { requireUser } from "~/lib/auth.server";
import { TopologyCanvas } from "~/components/topology/TopologyCanvas";

export const meta: MetaFunction = () => [{ title: "Clientes · Inframonitor" }];

export async function loader({ request }: LoaderFunctionArgs) {
  await requireUser(request);
  const { data } = await api(request).get<TopologyGraph>("/api/v1/topology/clients");
  return json({ graph: data });
}

export default function ClientesRoute() {
  const { graph } = useLoaderData<typeof loader>();
  return (
    <div className="flex flex-col h-full">
      <header className="px-6 py-4 border-b border-slate-200 bg-white">
        <h1 className="text-xl font-semibold">Clientes</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Vista por deploy · qué servidores y servicios usa cada cliente
        </p>
      </header>
      <div className="flex-1 min-h-0">
        <TopologyCanvas graph={graph} />
      </div>
    </div>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  const message = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error
    ? error.message
    : "Error desconocido";
  return (
    <div className="p-6">
      <div className="rounded-lg border border-red-200 bg-red-50 p-4">
        <h2 className="font-semibold text-red-700">No se pudo cargar la vista de clientes</h2>
        <p className="text-sm text-red-700/80 mt-1">{message}</p>
      </div>
    </div>
  );
}
