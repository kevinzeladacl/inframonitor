# Inframonitor

Plataforma web personal para visualizar y operar infraestructura distribuida en varios cloud providers (AWS, DigitalOcean, Azure), todo desde un solo lugar.

## ¿Qué hace?

1. **Visibilidad** — dos vistas sobre tu infra:
   - **Infraestructura** (técnica): Servidor → Contenedores Docker → Ambientes → Proyectos.
   - **Clientes** (por deploy): qué servidores/servicios usa cada cliente final (ej. "Isla de Maipo", "Muni Providencia").
2. **Operación** — terminal SSH web embebido, logs en vivo y búsqueda en buffer de 24 h.
3. **Provisioning** — wizard que crea una VM en cualquiera de los 3 providers y le aplica un *playbook* (instalar Docker, Docker + Traefik, bootstrap Node, hardening SSH, etc.).

## Stack

- **Monorepo** pnpm workspaces (`apps/*`, `packages/*`)
- **Frontend** Remix + TypeScript + Tailwind + Radix UI + Zustand + `@xyflow/react` + xterm.js
- **Backend** Express + TypeScript + Socket.IO + pino
- **DB** MongoDB + Mongoose 8
- **SSH** `ssh2` (Node) + `xterm.js` (web)
- **Cifrado credenciales** libsodium (`crypto_secretbox`)
- **Cloud SDKs** `@aws-sdk/client-ec2`, `dots-wrapper`, `@azure/arm-compute`
- **Dev/Deploy** Docker Compose

## Estructura

```
inframonitor/
├── apps/
│   ├── api/        # Express + Socket.IO
│   └── web/        # Remix + Vite
├── packages/
│   ├── database/   # Modelos Mongoose compartidos (@inframonitor/database)
│   └── shared-types/  # Enums, DTOs, socket events (@inframonitor/shared-types)
└── docker-compose.dev.yml   # solo Mongo
```

## Arranque (dev)

```bash
# 1. Configurar entorno
cp .env.example .env
# editar JWT_SECRET y OWNER_PASSWORD

# 2. Instalar deps
pnpm install

# 3. Levantar todo (Mongo + API + Web)
pnpm dev
```

- API: <http://localhost:8301>
- Web: <http://localhost:5274>

Verificación Fase 1: abre <http://localhost:5274/infraestructura> y deberías ver un grafo con el servidor seed.

## Scripts útiles

| Comando | Qué hace |
|---|---|
| `pnpm dev` | Build de packages → Mongo → init-db → API + Web en paralelo |
| `pnpm dev:db` | Solo Mongo en Docker |
| `pnpm dev:init` | Re-seed de la DB |
| `pnpm dev:api` | Solo API |
| `pnpm dev:web` | Solo Web |
| `pnpm stop` | Mata procesos locales y baja Mongo |
| `pnpm status` | Estado de contenedores y procesos node |

## Seguridad

- `.npmrc` con `minimum-release-age=1440` e `ignore-scripts=true` (defensas supply-chain).
- Credenciales cloud cifradas en reposo (libsodium), nunca serializadas en respuestas API.
- `MASTER_KEY` en `.env` fuera de git.

## Roadmap de fases

| Fase | Entregable |
|---|---|
| **1** | Esqueleto + 1 servidor mock visible en `/infraestructura` |
| 2 | Auth real + CRUD UI completo |
| 3 | Cloud Sources + import read-only AWS/DO/Azure |
| 4 | SSH terminal web + sync de containers |
| 5 | Logs streaming + buffer 24 h con TTL |
| 6 | Playbooks catálogo + ejecución streaming |
| 7 | Wizard de provisioning end-to-end |
