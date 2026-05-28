import { Form, Link, NavLink } from "@remix-run/react";
import {
  LayoutGrid,
  Network,
  Users,
  Server,
  Cloud,
  Settings,
  LogOut,
  Boxes,
  Folder,
  Layers,
  Key,
  FileText,
  ScrollText,
  Rocket,
} from "lucide-react";
import { cn } from "~/lib/cn";
import type { SessionUser } from "~/lib/auth.server";

interface NavItem {
  to: string;
  label: string;
  icon: typeof Network;
  group?: "principal" | "config";
}

const navItems: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutGrid },
  { to: "/infraestructura", label: "Infraestructura", icon: Network },
  { to: "/clientes", label: "Clientes (mapa)", icon: Users },
  { to: "/servers", label: "Servidores", icon: Server },
  { to: "/containers", label: "Contenedores", icon: Boxes },
  { to: "/logs", label: "Logs (24h)", icon: FileText },
  { to: "/playbooks", label: "Playbooks", icon: ScrollText },
  { to: "/servers/nuevo", label: "+ Nuevo servidor", icon: Rocket },
  { to: "/projects", label: "Proyectos", icon: Folder, group: "config" },
  { to: "/environments", label: "Ambientes", icon: Layers, group: "config" },
  { to: "/clientes-admin", label: "Clientes (admin)", icon: Users, group: "config" },
  { to: "/settings/cloud-sources", label: "Cloud Sources", icon: Cloud, group: "config" },
  { to: "/settings/ssh-keys", label: "SSH Keys", icon: Key, group: "config" },
];

export function AppShell({
  children,
  user,
}: {
  children: React.ReactNode;
  user: SessionUser;
}) {
  return (
    <div className="flex h-full">
      <aside className="w-64 shrink-0 border-r border-slate-200 bg-white flex flex-col">
        <Link to="/dashboard" className="px-4 py-5 border-b border-slate-200">
          <div className="text-xl font-bold tracking-tight text-brand-600">
            Inframonitor
          </div>
          <div className="text-xs text-slate-500 mt-0.5">v0.7.0 · MVP</div>
        </Link>

        <nav className="flex-1 py-2 overflow-y-auto">
          {navItems
            .filter((i) => i.group !== "config")
            .map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 px-4 py-2 text-sm transition-colors",
                    isActive
                      ? "bg-brand-50 text-brand-700 border-l-2 border-brand-500"
                      : "text-slate-700 hover:bg-slate-50"
                  )
                }
              >
                <Icon className="size-4" />
                <span>{label}</span>
              </NavLink>
            ))}
          <div className="px-4 pt-4 pb-1 text-[10px] uppercase tracking-wider text-slate-400">
            Configuración
          </div>
          {navItems
            .filter((i) => i.group === "config")
            .map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 px-4 py-2 text-sm transition-colors",
                    isActive
                      ? "bg-brand-50 text-brand-700 border-l-2 border-brand-500"
                      : "text-slate-700 hover:bg-slate-50"
                  )
                }
              >
                <Icon className="size-4" />
                <span>{label}</span>
              </NavLink>
            ))}
        </nav>

        <div className="border-t border-slate-200 p-3 flex items-center gap-2 text-xs">
          <div className="flex-1 min-w-0">
            <div className="font-medium text-slate-900 truncate">{user.email}</div>
            <div className="text-slate-500 uppercase">{user.role}</div>
          </div>
          <Form method="post" action="/logout">
            <button
              type="submit"
              title="Cerrar sesión"
              className="p-1.5 rounded text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            >
              <LogOut className="size-4" />
            </button>
          </Form>
        </div>
      </aside>
      <main className="flex-1 min-w-0 overflow-hidden flex flex-col">
        {children}
      </main>
    </div>
  );
}
