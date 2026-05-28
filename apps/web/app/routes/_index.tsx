import { redirect, type LoaderFunctionArgs } from "@remix-run/node";
import { getOptionalUser } from "~/lib/auth.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await getOptionalUser(request);
  return redirect(user ? "/dashboard" : "/login");
}

export default function Index() {
  return null;
}
