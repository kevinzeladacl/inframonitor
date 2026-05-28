# Roadmap — De MVP a "operativo en producción"

> Estado actual: MVP funcional de las 7 fases del plan. Lo que sigue cierra
> brechas para que la herramienta sea **usable día-a-día contra infra real**,
> no sólo demo.

## Cómo leer este documento

| Prioridad | Significado |
|---|---|
| **P0** | Bloqueante para usar la herramienta en producción real con infra propia |
| **P1** | Necesario para que el equipo confíe en operarla a diario |
| **P2** | Mejora calidad de vida / refuerza diferencial competitivo |
| **P3** | Preparación para abrir el código (open source bajo Mocca) |

Cada item lleva **estimación** en días de trabajo full-time de un dev senior.
Sumamos hitos al final.

---

## P0 · Bloqueantes operacionales

### P0.1 · Rate limiting en `/auth/login` (1d)
`express-rate-limit` ya está instalado pero no aplicado. Brute-force trivial
hoy. Aplicar 5 intentos / 15 min por IP en `/auth/login` y registrar excesos
en `AuditLog`.

### P0.2 · AuditLog vivo (1d)
El schema `AuditLog` existe pero ningún servicio lo escribe. Eventos
mínimos a auditar:
- `auth.login.success` / `auth.login.failed`
- `cloud-source.credentials.decrypted` (qué CS, cuándo)
- `server.terminate`, `server.start`, `server.stop`
- `ssh-key.generated`, `ssh-key.deleted`
- `playbook.run.started/finished`
- `provision.start/cancel`

Inyectar un service `auditService.log(action, entity, entityId, metadata)`
llamado desde los routes/services. Mostrar en una página `/audit` (paginada,
filtrable por acción).

### P0.3 · Cron de reconciliación cloud → DB (2d)
`node-cron` instalado pero sin jobs. Necesario:
- Cada 5 min, para cada `CloudSource` con `enabled=true`: llamar
  `adapter.listInstances()` y actualizar `Server.status`, `lastSeenAt`,
  `publicIp`, `privateIp`. Mismo `update path` que `import-servers`.
- Detectar drift: si un Server existe en DB con `providerInstanceId` pero
  no en el listado real → marcar `status="terminated"` (no borrar).
- Detectar instancias nuevas creadas fuera de Inframonitor: import auto.

### P0.4 · SSH host fingerprint TOFU (1d)
`Server.ssh.hostFingerprint` está en el schema pero nunca se persiste.
En `ssh.service.openSshClient` agregar callback `hostVerifier`:
- Si `server.ssh.hostFingerprint` está vacío → aceptar y guardarlo.
- Si existe y no coincide → rechazar la conexión con `MITM_DETECTED`.

Crítico para evitar MITM cuando un IP se recicla en el cloud.

### P0.5 · AWS image (AMI) lookup en el wizard (1d)
Hoy el campo "OS" del wizard espera un AMI id a mano (`ami-xxxxxxx`).
Implementar `DescribeImages` filtrado por `owners=["amazon"]` + `name=ubuntu*22.04*`
para devolver opciones razonables. Para DO ya funciona con slug. Para Azure
queda igual hasta que se complete `createInstance` (P2).

### P0.6 · Dockerfiles + `docker-compose.prod.yml` (1d)
Faltan:
- `apps/api/Dockerfile` (multistage: build tsc + runtime distroless)
- `apps/web/Dockerfile` (multistage: remix build + serve)
- `docker-compose.prod.yml` con api + web + mongo + Traefik + volumes
- Variables tomadas de `.env` montado read-only

Hoy `pnpm dev` corre todo nativo. Para producción necesitamos contenedores.

### P0.7 · Backup automatizado de Mongo (0.5d)
Cron `node-cron` o crontab del host que ejecuta `mongodump` diario al volumen
`data/backups/`. Retención de 7 días. Documentar el procedimiento de restore.

### P0.8 · Healthcheck completo (0.5d)
`/health` hoy devuelve solo `mongo`. Agregar:
- Espacio en disco del host
- Memoria del proceso
- Sockets activos por namespace
- Conexiones SSH activas
- Última ejecución del cron de reconciliación

### P0.9 · Graceful shutdown de SSH/sockets (0.5d)
En SIGTERM cerrar todos los `ssh2.Client` activos (terminal, logs, runners) y
emitir evento `server-shutdown` a los sockets para que el frontend muestre
"se está reiniciando". Ya está SIGTERM básico, falta el cleanup de canales.

### P0.10 · Logout efectivo en cookie (0.5d)
JWT es stateless; `/auth/logout` clear-cookie funciona en el browser, pero un
token capturado sigue siendo válido hasta que expira (7d). En MVP single-user
es aceptable. Si subimos exposición:
- Cortar TTL a 24h
- O agregar `TokenBlacklist` (collection ya planeada pero no usada)

---

## Hito P0 — total: **~8.5 días**

> Al cerrar P0, Inframonitor es seguro de exponer (con SSL externo) para
> uso personal contra infra propia. La operación diaria es viable.

---

## P1 · Operativo con confianza para el equipo

### P1.1 · Reverse proxy Traefik + Let's Encrypt SSL (1d)
- Agregar Traefik al `docker-compose.prod.yml` con labels para api y web.
- Cert automático con `tlschallenge` o `dnschallenge`.
- Documentar el DNS A record que el operador debe crear.

### P1.2 · GitHub Actions CI (1d)
- `.github/workflows/ci.yml` con jobs:
  - `pnpm install --frozen-lockfile`
  - `pnpm run build:packages`
  - `pnpm -r run typecheck`
  - (futuro) `pnpm test`
- Trigger en PR + push a `main`.
- Caché de `node_modules` con pnpm store.

### P1.3 · Métricas live de containers (2d)
`Container.statsSnapshot` está en el schema pero nadie lo llena. Implementar:
- Cron que para cada server `running` haga SSH y corra
  `docker stats --no-stream --format '{{json .}}'` (~5s).
- Persistir cpu%, mem mb, net rx/tx en `Container.statsSnapshot`.
- Vista pequeña sparkline en `/containers` y en `/servers/:id?tab=containers`.

### P1.4 · Cron de heartbeat por server (1d)
- Cada server `running`: SSH `uptime` cada 60s.
- Actualizar `Server.lastSeenAt` + `uptimeSeconds`.
- Si 3 fallos consecutivos → `status="error"` + alerta.

### P1.5 · Toast notifications + loading states (2d)
- Instalar `sonner` (ya está en `garagepro` como dep).
- Reemplazar `window.confirm` con dialogs Radix (`@radix-ui/react-alert-dialog`).
- Skeleton loaders en tablas mientras `fetcher.state !== "idle"`.
- Mensajes consistentes de éxito/error en cada CRUD.

### P1.6 · Editor YAML mejorado para playbooks (1d)
- Validación YAML inline (parser + marca errores en línea).
- Autocomplete básico para `name`, `command`, `timeoutSec`.
- Vista previa del shell que se va a ejecutar antes de guardar.
- Opcional: integrar Monaco editor (pesado, evaluar bundle size).

### P1.7 · Pricing dinámico para AWS/Azure (2d)
- AWS: `@aws-sdk/client-pricing` con filter `productFamily=Compute Instance`
  cacheado en `CloudSource.priceCache` con TTL 24h.
- Azure: Pricing API tiene un endpoint REST público (sin auth).
- Resultado en `Server.costEstimate` actualizado por el cron de reconciliación.

### P1.8 · Vista de PlaybookRuns con histórico y diff (2d)
- Nueva ruta `/playbook-runs` con tabla filtrable por server/slug/status.
- Detalle: `/playbook-runs/:id` con output completo + duración por step.
- Botón "Re-run" desde un run existente con mismo target.

### P1.9 · Bulk actions en tablas (1d)
- Checkbox de selección múltiple en `/servers`, `/containers`.
- Acciones bulk: terminate, stop, start, assign to client.

### P1.10 · `/docs` integrada con la app (1d)
- Página dentro de la app que sirve `docs/*.md` renderizado (CONCEPTO, ROADMAP).
- Útil para onboarding de nuevos operadores sin abrir GitHub.

---

## Hito P1 — total: **~14 días**

> Al cerrar P1, el equipo Mocca puede operar Inframonitor sin tickets de
> soporte. La herramienta es **estable** y **medible**.

---

## P2 · Diferencial y calidad de vida

### P2.1 · Azure `createInstance` completo (3d)
Hoy tira "not implemented". Implementar el flujo multi-recurso:
- `ResourceManagementClient.resourceGroups.createOrUpdate("inframonitor-{region}")`
- `NetworkManagementClient.virtualNetworks.createOrUpdate(...)`
- `NetworkManagementClient.publicIPAddresses.createOrUpdate(...)`
- `NetworkManagementClient.networkInterfaces.createOrUpdate(...)`
- `ComputeManagementClient.virtualMachines.beginCreateOrUpdate(...)`
- Rollback si cualquier paso falla.

### P2.2 · Notificaciones por email + Slack (2d)
- Email: SendGrid SDK (ya en `garagepro`).
- Slack: webhook URL configurable por CloudSource.
- Eventos: `server.terminated`, `playbook.failed`, `provision.done`,
  `provision.failed`, `cloud-source.verify.failed`.
- Tabla `NotificationRule` para suscribirse a eventos.

### P2.3 · Dark mode + diseño responsive (2d)
- `next-themes` (ya en `garagepro`).
- Audit completo de Tailwind classes para versions dark.
- Sidebar colapsable + drawer mobile.

### P2.4 · Búsqueda global (`Cmd+K`) (2d)
- Componente `<CommandMenu>` (cmdk).
- Indexar: server name, container name, IP, project slug, client name.
- Salto rápido a la entidad encontrada.

### P2.5 · Drag & drop en topología (2d)
- Permitir mover nodos manualmente y persistir posición en
  `Container.position`, `Server.position`, etc.
- Re-layout automático con dagre o elk.

### P2.6 · Tests automatizados (3d)
- Backend: `vitest` con setup de Mongo en memoria (`mongodb-memory-server`).
- Frontend: tests de loaders/actions con `@remix-run/testing`.
- E2E: Playwright con un test "login → crear servidor → ver en topología".
- Cobertura mínima 60% en services y routes.

### P2.7 · Filtros guardados y vistas personalizadas (1d)
- Guardar query params (`?provider=aws&status=running`) como "vista
  favorita" en `User.preferences`.
- Quick chips en cada tabla.

### P2.8 · Multi-region pricing comparator (1d)
- En el wizard, mostrar matriz "Tamaño × Región" con precios.
- Sortable por mejor precio.

---

## Hito P2 — total: **~16 días**

> Al cerrar P2, Inframonitor se siente como **producto**, no como herramienta
> interna. Puede ir a portfolio o presentación a clientes.

---

## P3 · Open source ready (cuando se defina con CTO)

### P3.1 · LICENSE (0.1d)
Recomendado: **Apache-2.0** (incluye cláusula de patentes, más amigable
para empresas).

### P3.2 · `CONTRIBUTING.md` + `CODE_OF_CONDUCT.md` (0.5d)
Boilerplate de GitHub. Mocca Code of Conduct si existe.

### P3.3 · `SECURITY.md` con política de disclosure (0.5d)
- Email de contacto (`security@mocca...`)
- SLA de respuesta (ej. 48h)
- Hall of fame para reportes válidos.

### P3.4 · README con badges + screenshots/GIFs (1d)
- CI status, license, latest release, downloads.
- 3-4 screenshots de las vistas principales.
- GIF de 20s del wizard de provisioning end-to-end.

### P3.5 · `AUTHORS` + atribución a `mocca-platform` (0.2d)
Si Mocca es el owner final, agregar nota en el README citando los proyectos
hermanos donde nació la idea/stack.

### P3.6 · Release management con semver (1d)
- `release-please` o `changesets` para automatizar CHANGELOG + tags.
- Versiones `v1.0.0-rc.1` etc.

### P3.7 · Documentación pública en GitHub Pages (2d)
- Convertir `docs/` a un sitio estático (mdBook, Docusaurus, o Astro).
- Deploy automático en `gh-pages` desde `main`.

### P3.8 · Plugin/extension API para providers custom (3d)
- Definir interfaz `CloudProviderAdapter` como package separado
  `@inframonitor/provider-sdk`.
- Permitir cargar adapters externos (`@inframonitor-providers/hetzner`,
  `@inframonitor-providers/linode`, etc.) por config.

---

## Hito P3 — total: **~8.3 días**

> Listo para anuncio público, contribuciones externas, marketing.

---

## Resumen total y plan de release

| Hito | Días | Acumulado | Estado del producto |
|---|---|---|---|
| **MVP actual** | (hecho) | 0 | Demo funcional, no apto para prod |
| **+ P0** | 8.5 | 8.5 | Apto para uso personal serio |
| **+ P1** | 14 | 22.5 | Apto para equipo Mocca operando a diario |
| **+ P2** | 16 | 38.5 | Producto pulido, presentable externamente |
| **+ P3** | 8.3 | 46.8 | Open source público con comunidad |

**~47 días-persona** para llegar a OSS production-ready completo.
Asumiendo 1 dev senior part-time (50% dedicación) → **~5 meses** calendario.
Con foco full-time → **~10 semanas**.

---

## Decisiones pendientes con el CTO

Algunas cosas requieren decisión antes de avanzar mucho:

1. **¿Open source bajo qué org GitHub?** `mocca-labs/inframonitor` ·
   `moccaplatform/inframonitor` · otra.
2. **¿Multi-tenancy en algún momento?** Si sí, P3 no aplica tal cual; hay
   que diseñar el modelo de Org/User/Workspace antes de hacer público.
3. **¿Distribución?** Self-hosted (docker compose) vs SaaS Mocca-managed.
   Cambia las prioridades de P0.6, P0.7, P0.10.
4. **¿Branding final?** Si el nombre cambia, hay que renombrar package
   names (`@inframonitor/database` → `@mocca/foo`).
5. **¿Cobertura cloud?** ¿Se agregan Hetzner/Linode/GCP? Si sí, P3.8
   sube a P1.
6. **¿Audit trail compliance?** Si la herramienta termina manejando infra
   regulada (LGPD/GDPR/PCI), AuditLog necesita inmutabilidad
   criptográfica — eso es 3-5 días extra de diseño.

---

## Riesgos de no atacar P0

| Si no se hace... | Consecuencia | Tiempo medio antes de pasar |
|---|---|---|
| Rate limiting login | Brute force exitoso si JWT_SECRET filtra | semanas |
| AuditLog vivo | Sin forensia tras incidente | inmediato (al primer incidente) |
| Cron reconciliación | Estado desincronizado con cloud, decisiones erróneas | días |
| SSH fingerprint TOFU | Vulnerable a MITM al cambiar IP | meses |
| Dockerfiles prod | No se puede desplegar fuera del laptop del owner | inmediato |
| Backups Mongo | Pérdida total al primer fallo de disco | impredecible |

---

*Documento mantenido en `docs/ROADMAP.md` · v1.0 · 2026-05-27*
