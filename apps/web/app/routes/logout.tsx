import { type ActionFunctionArgs, redirect } from "@remix-run/node";
import { api, forwardSetCookie } from "~/lib/api.server";

export async function action({ request }: ActionFunctionArgs) {
  const res = await api(request).post("/api/v1/auth/logout");
  return redirect("/login", { headers: forwardSetCookie(res) });
}

export async function loader() {
  return redirect("/login");
}
