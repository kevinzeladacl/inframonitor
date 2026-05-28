import { Router } from "express";
import { mongoStatus } from "../config/db.js";

export const healthRouter = Router();

const bootTime = Date.now();

healthRouter.get("/", (_req, res) => {
  const mongo = mongoStatus();
  res.json({
    status: mongo === "ok" ? "ok" : "degraded",
    uptimeSec: Math.floor((Date.now() - bootTime) / 1000),
    mongo,
    version: process.env.npm_package_version ?? "0.1.0",
  });
});
