import { type ActionFunctionArgs, type LoaderFunctionArgs, type MetaFunction, json, redirect } from "@remix-run/node";
import { Form, useActionData, useFetcher, useLoaderData } from "@remix-run/react";
import { Rocket } from "lucide-react";
import { api } from "~/lib/api.server";
import { requireUser } from "~/lib/auth.server";
import { PageHeader } from "~/components/ui/PageHeader";
import { Field, SelectField } from "~/components/ui/Field";
import { Button } from "~/components/ui/Button";

export const meta: MetaFunction = () => [{ title: "Nuevo servidor · Wizard · Inframonitor" }];

interface CloudSourceLite { id: string; name: string; provider: string; verifiedAt?: string | null }
interface PlaybookLite { slug: string; name: string; isBuiltin: boolean }

export async function loader({ request }: LoaderFunctionArgs) {
  await requireUser(request);
  const [cs, pb] = await Promise.all([
    api(request).get<{ items: CloudSourceLite[] }>("/api/v1/cloud-sources"),
    api(request).get<{ items: PlaybookLite[] }>("/api/v1/playbooks"),
  ]);
  return json({
    cloudSources: cs.data?.items ?? [],
    playbooks: pb.data?.items ?? [],
  });
}

export async function action({ request }: ActionFunctionArgs) {
  await requireUser(request);
  const form = await request.formData();
  const intent = String(form.get("intent") ?? "");

  if (intent === "regions" || intent === "sizes") {
    const cloudSourceId = String(form.get("cloudSourceId") ?? "");
    const endpoint = intent === "regions" ? "regions" : "sizes";
    const res = await api(request).get(`/api/v1/cloud-sources/${cloudSourceId}/${endpoint}`);
    return json(res.data);
  }

  if (intent === "preview") {
    const body = Object.fromEntries(form);
    delete (body as any).intent;
    const res = await api(request).post("/api/v1/provision/preview", body);
    return json(res.data);
  }

  if (intent === "launch") {
    const body = Object.fromEntries(form);
    delete (body as any).intent;
    const res = await api(request).post("/api/v1/provision/start", body);
    if (res.status >= 400) return json({ error: res.data?.error?.message ?? "Provision falló" }, { status: 400 });
    return redirect(`/provision/${res.data.taskId}`);
  }

  return null;
}

export default function NewServerWizard() {
  const { cloudSources, playbooks } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const regionsFetcher = useFetcher<any>();
  const sizesFetcher = useFetcher<any>();
  const previewFetcher = useFetcher<any>();

  const verifiedCS = cloudSources.filter((c) => c.verifiedAt);
  const csOptions = verifiedCS.map((c) => ({ value: c.id, label: `${c.name} (${c.provider})` }));
  const regions = regionsFetcher.data?.regions ?? [];
  const sizes = sizesFetcher.data?.sizes ?? [];
  const preview = previewFetcher.data;

  return (
    <div className="flex flex-col h-full overflow-auto">
      <PageHeader
        title="Wizard de provisioning"
        description="Crea una VM real en AWS / DigitalOcean / Azure y aplícale un playbook automáticamente."
      />

      {verifiedCS.length === 0 ? (
        <div className="m-6 p-4 border border-amber-200 bg-amber-50 rounded-lg text-sm text-amber-800">
          ⚠️ Necesitas al menos una <strong>Cloud Source verificada</strong> antes de usar el wizard. Ve a{" "}
          <a href="/settings/cloud-sources" className="underline">Settings → Cloud Sources</a> y verifica una.
        </div>
      ) : null}

      <Form method="post" className="p-6 space-y-6 max-w-3xl">
        <input type="hidden" name="intent" value="launch" />

        <Section step={1} title="Cloud Source">
          <SelectField label="Cuenta" name="cloudSourceId" required options={csOptions} emptyLabel="— Elegir —" />
          <div className="flex gap-2 mt-2">
            <regionsFetcher.Form method="post" className="contents">
              <input type="hidden" name="intent" value="regions" />
              <CloudIdMirror />
              <Button size="sm" variant="secondary" type="submit">Cargar regiones</Button>
            </regionsFetcher.Form>
            <sizesFetcher.Form method="post" className="contents">
              <input type="hidden" name="intent" value="sizes" />
              <CloudIdMirror />
              <Button size="sm" variant="secondary" type="submit">Cargar tamaños</Button>
            </sizesFetcher.Form>
          </div>
        </Section>

        <Section step={2} title="Ubicación & tamaño">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <SelectField
              label="Región"
              name="region"
              required
              options={regions.map((r: any) => ({ value: r.slug, label: r.name }))}
              emptyLabel={regions.length ? "— Elegir —" : "(Primero cargar regiones)"}
            />
            <SelectField
              label="Tamaño / instance type"
              name="size"
              required
              options={sizes.map((s: any) => ({ value: s.slug, label: s.name }))}
              emptyLabel={sizes.length ? "— Elegir —" : "(Primero cargar tamaños)"}
            />
          </div>
        </Section>

        <Section step={3} title="OS / Imagen">
          <Field
            label="Imagen / AMI / slug"
            name="os"
            required
            placeholder="ubuntu-22-04-x64 (DO) · ami-xxxx (AWS) · UbuntuServer (Azure)"
          />
          <p className="text-xs text-slate-500 mt-1">
            DigitalOcean: <code>ubuntu-22-04-x64</code>. AWS: el AMI id de tu región. Azure: imagen disponible.
          </p>
        </Section>

        <Section step={4} title="Playbook (opcional)">
          <SelectField
            label="Playbook a ejecutar post-provisioning"
            name="playbookSlug"
            emptyLabel="— Ninguno —"
            options={playbooks.map((p) => ({ value: p.slug, label: `${p.name}${p.isBuiltin ? " (built-in)" : ""}` }))}
          />
        </Section>

        <Section step={5} title="Confirmar">
          <Field label="Nombre del server" name="name" required placeholder="prod-web-01" />
          <div className="flex flex-wrap gap-2 mt-3">
            <previewFetcher.Form method="post" className="contents">
              <input type="hidden" name="intent" value="preview" />
              <PreviewMirror />
              <Button type="submit" variant="secondary">Calcular costo</Button>
            </previewFetcher.Form>
            <Button type="submit" disabled={verifiedCS.length === 0}>
              <Rocket className="size-4" /> Lanzar provisioning
            </Button>
          </div>

          {preview ? (
            <div className="mt-3 rounded-md bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-800">
              <strong>Costo estimado:</strong> ${preview.hourlyUsd?.toFixed(4) ?? "—"}/h ·{" "}
              ${preview.monthlyUsd?.toFixed(2) ?? "—"}/mes
            </div>
          ) : null}

          {actionData && "error" in actionData && actionData.error ? (
            <div className="mt-3 rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
              ✗ {actionData.error}
            </div>
          ) : null}
        </Section>
      </Form>
    </div>
  );
}

// Mini componentes que copian valores del form principal a los fetchers.
function CloudIdMirror() {
  return (
    <input
      type="hidden"
      name="cloudSourceId"
      ref={(el) => {
        if (!el) return;
        const source = document.querySelector<HTMLSelectElement>('select[name="cloudSourceId"]');
        if (source) el.value = source.value;
      }}
    />
  );
}
function PreviewMirror() {
  return (
    <>
      {(["cloudSourceId", "region", "size", "os", "name", "playbookSlug"] as const).map((n) => (
        <input
          key={n}
          type="hidden"
          name={n}
          ref={(el) => {
            if (!el) return;
            const source = document.querySelector<HTMLInputElement | HTMLSelectElement>(`[name="${n}"]`);
            if (source) el.value = (source as HTMLInputElement).value;
          }}
        />
      ))}
    </>
  );
}

function Section({ step, title, children }: { step: number; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-3 mb-3">
        <span className="inline-flex size-7 items-center justify-center rounded-full bg-brand-600 text-white text-sm font-bold">
          {step}
        </span>
        <h3 className="text-base font-semibold">{title}</h3>
      </div>
      {children}
    </div>
  );
}
