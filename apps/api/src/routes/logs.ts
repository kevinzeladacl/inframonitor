import { Router } from "express";
import { z } from "zod";
import { LogEntryModel } from "@inframonitor/database";

export const logsRouter = Router();

const querySchema = z.object({
  serverId: z.string().optional(),
  containerId: z.string().optional(),
  level: z.enum(["debug", "info", "warn", "error"]).optional(),
  since: z.string().optional(),
  until: z.string().optional(),
  q: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(1000).default(200),
});

logsRouter.get("/", async (req, res, next) => {
  try {
    const { serverId, containerId, level, since, until, q, limit } = querySchema.parse(req.query);
    const filter: Record<string, unknown> = { deletedAt: null };
    if (serverId) filter.serverId = serverId;
    if (containerId) filter.containerId = containerId;
    if (level) filter.level = level;
    if (since || until) {
      const ts: Record<string, Date> = {};
      if (since) ts.$gte = new Date(since);
      if (until) ts.$lte = new Date(until);
      filter.ts = ts;
    }
    if (q) filter.message = { $regex: q, $options: "i" };

    const items = await LogEntryModel.find(filter).sort({ ts: -1 }).limit(limit).lean();
    res.json({
      items: items.map(({ _id, __v, ...rest }: any) => {
        void _id; void __v;
        return rest;
      }),
    });
  } catch (err) {
    next(err);
  }
});
