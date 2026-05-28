import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useRouteError,
  isRouteErrorResponse,
  useLoaderData,
  useLocation,
} from "@remix-run/react";
import type { LinksFunction, LoaderFunctionArgs, MetaFunction } from "@remix-run/node";

import "@xyflow/react/dist/style.css";
import tailwindStyles from "./tailwind.css?url";
import { AppShell } from "./components/layout/AppShell";
import { getOptionalUser } from "./lib/auth.server";

export const meta: MetaFunction = () => [
  { title: "Inframonitor" },
  { name: "viewport", content: "width=device-width,initial-scale=1" },
];

export const links: LinksFunction = () => [{ rel: "stylesheet", href: tailwindStyles }];

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await getOptionalUser(request);
  return { user };
}

export default function App() {
  const { user } = useLoaderData<typeof loader>();
  const location = useLocation();
  const isLogin = location.pathname === "/login";

  return (
    <html lang="es" className="h-full">
      <head>
        <meta charSet="utf-8" />
        <Meta />
        <Links />
      </head>
      <body className="h-full">
        {isLogin || !user ? (
          <Outlet />
        ) : (
          <AppShell user={user}>
            <Outlet />
          </AppShell>
        )}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
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
    <html lang="es">
      <head>
        <title>Error · Inframonitor</title>
        <Meta />
        <Links />
      </head>
      <body className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="max-w-lg p-8 rounded-xl border border-red-200 bg-white shadow">
          <h1 className="text-2xl font-semibold text-red-700">Algo salió mal</h1>
          <p className="mt-2 text-slate-700">{message}</p>
        </div>
        <Scripts />
      </body>
    </html>
  );
}
