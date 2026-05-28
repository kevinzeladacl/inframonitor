import {
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
  type MetaFunction,
  redirect,
} from "@remix-run/node";
import { Form, useActionData, useNavigation } from "@remix-run/react";
import { api, forwardSetCookie } from "~/lib/api.server";
import { getOptionalUser } from "~/lib/auth.server";

export const meta: MetaFunction = () => [{ title: "Login · Inframonitor" }];

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await getOptionalUser(request);
  if (user) throw redirect("/dashboard");
  return null;
}

export async function action({ request }: ActionFunctionArgs) {
  const form = await request.formData();
  const email = String(form.get("email") ?? "");
  const password = String(form.get("password") ?? "");

  if (!email || !password) {
    return { error: "Email y contraseña son requeridos" };
  }

  const res = await api(request).post("/api/v1/auth/login", { email, password });
  if (res.status !== 200) {
    return {
      error: res.data?.error?.message ?? "Credenciales inválidas",
    };
  }

  // Propagar Set-Cookie del backend al browser
  return redirect("/dashboard", { headers: forwardSetCookie(res) });
}

export default function LoginRoute() {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const submitting = navigation.state === "submitting";

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-slate-50">
      <div className="w-full max-w-sm bg-white rounded-xl shadow-lg border border-slate-200 p-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-brand-600">Inframonitor</h1>
          <p className="text-sm text-slate-500 mt-1">Iniciar sesión</p>
        </div>

        <Form method="post" className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
            <input
              type="email"
              name="email"
              autoComplete="email"
              required
              autoFocus
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="owner@inframonitor.local"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Contraseña</label>
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              required
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          {actionData?.error ? (
            <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
              {actionData.error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md bg-brand-600 hover:bg-brand-700 disabled:bg-slate-400 text-white text-sm font-medium py-2 transition-colors"
          >
            {submitting ? "Ingresando…" : "Ingresar"}
          </button>
        </Form>

        <p className="mt-6 text-xs text-slate-500 text-center">
          MVP single-tenant · Usa las credenciales del `.env`
        </p>
      </div>
    </div>
  );
}
