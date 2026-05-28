import { Router } from "express";
import { topologyRouter } from "./topology.js";
import { healthRouter } from "./health.js";
import { authRouter } from "./auth.js";
import { serversRouter } from "./servers.js";
import { containersRouter } from "./containers.js";
import { environmentsRouter } from "./environments.js";
import { projectsRouter } from "./projects.js";
import { clientsRouter } from "./clients.js";
import { cloudSourcesRouter } from "./cloud-sources.js";
import { sshKeysRouter } from "./ssh-keys.js";
import { logsRouter } from "./logs.js";
import { playbooksRouter } from "./playbooks.js";
import { provisionRouter } from "./provision.js";
import { serverActionsRouter } from "./server-actions.js";

/** Endpoints públicos: no requieren JWT (login/logout/me + health) */
export const publicApiRouter = Router();
publicApiRouter.use("/auth", authRouter);
publicApiRouter.use("/health", healthRouter);

/** Endpoints protegidos: el middleware requireAuth se monta encima en http.ts */
export const apiRouter = Router();
apiRouter.use("/topology", topologyRouter);
apiRouter.use("/containers", containersRouter);
apiRouter.use("/environments", environmentsRouter);
apiRouter.use("/projects", projectsRouter);
apiRouter.use("/clients", clientsRouter);
apiRouter.use("/cloud-sources", cloudSourcesRouter);
apiRouter.use("/ssh-keys", sshKeysRouter);
apiRouter.use("/logs", logsRouter);
apiRouter.use("/playbooks", playbooksRouter);
apiRouter.use("/provision", provisionRouter);
// /servers tiene 2 routers: el CRUD genérico y acciones específicas (sync, start/stop, terminate).
// Express los compone por orden — primero las acciones, luego el CRUD.
apiRouter.use("/servers", serverActionsRouter);
apiRouter.use("/servers", serversRouter);
