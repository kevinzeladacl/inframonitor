# CLAUDE.md — Inframonitor

Convenciones para futuras sesiones con Claude Code en este repo.

## Idioma
- Comentarios, README y mensajes commit: **español**.
- Código (variables, funciones, identificadores): **inglés**.

## Stack confirmado
- Monorepo pnpm (`apps/*`, `packages/*`).
- Node ≥ 20, pnpm ≥ 10 (preferible 11). `.npmrc` ya bloquea install scripts y aplica `minimum-release-age=1440`.
- Frontend: Remix + Tailwind 3 + Radix + Zustand + `@xyflow/react` + xterm.js.
- Backend: Express + Socket.IO + pino + `ssh2`.
- DB: MongoDB + Mongoose 8.
- Cifrado: libsodium (`crypto_secretbox`).
- Cloud SDKs: AWS SDK v3, `dots-wrapper`, `@azure/arm-compute`.

## Patrones a seguir
- Entidades Mongoose en `packages/database/src/entities/<Name>/{schema.ts, model.ts, index.ts}` (un archivo por entidad).
- Cada entidad expone `id` (UUID) además del `_id`. Soft delete con `deletedAt`.
- Endpoints API bajo `/api/v1`. Auth con `Bearer JWT` en cookie HttpOnly excepto `/auth/*` y `/health`.
- Validación de payloads con `zod`.
- En Vista Topología, el backend (`/topology/infrastructure`, `/topology/clients`) **agrupa los datos**; el frontend solo renderiza nodos+edges.
- Socket.IO en namespaces: `/terminal`, `/logs`, `/provision`.

## Plan de fases vigente
Ver el plan canónico en `/Users/mri/.claude/plans/necesito-crear-una-web-generic-brook.md`.

Fase actual: **1** — esqueleto + servidor mock en `/infraestructura`.

## Seguridad
- Credenciales cloud cifradas en reposo (libsodium). `toJSON` las omite.
- `MASTER_KEY` solo en `.env`, jamás commit.
- En playbooks custom, sanitizar nombres antes de interpolar en comandos shell.

## Puertos
- API: `8301`
- Web: `5274`
- Mongo: `27117` (host) → `27017` (contenedor)
