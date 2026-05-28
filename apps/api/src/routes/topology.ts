import { Router } from "express";
import {
  buildInfrastructureGraph,
  buildClientsGraph,
} from "../services/topology.service.js";

export const topologyRouter = Router();

topologyRouter.get("/infrastructure", async (_req, res, next) => {
  try {
    const graph = await buildInfrastructureGraph();
    res.json(graph);
  } catch (err) {
    next(err);
  }
});

topologyRouter.get("/clients", async (_req, res, next) => {
  try {
    const graph = await buildClientsGraph();
    res.json(graph);
  } catch (err) {
    next(err);
  }
});
