import { Router } from "express";
import type { Model } from "mongoose";
import { z, type ZodTypeAny } from "zod";

/**
 * Factory de routers CRUD homogéneos para entidades simples.
 *
 * Convención:
 * - GET /        → lista (acepta `?` filters definidos en `listFilter`)
 * - POST /       → crea (valida con `createSchema`)
 * - GET /:id     → detalle
 * - PATCH /:id   → update parcial (valida con `updateSchema`)
 * - DELETE /:id  → soft delete (set `deletedAt`)
 *
 * Identificador en la URL: siempre el `id` UUID propio, no `_id`.
 */
export interface CrudOptions<TCreate, TUpdate> {
  /** Mongoose model. */
  model: Model<any>;
  /** Schema zod para POST. */
  createSchema: ZodTypeAny;
  /** Schema zod para PATCH. */
  updateSchema: ZodTypeAny;
  /**
   * Función opcional que mapea `req.query` a un filter Mongoose.
   * Si no se pasa, se ignoran los query params.
   */
  listFilter?: (q: Record<string, string | undefined>) => Record<string, unknown>;
  /** Para mensajes de error humanos. */
  name: string;
  /** Si true, no permite delete (entidades sin soft delete viable). */
  readonlyDelete?: boolean;
}

export function makeCrudRouter<TCreate, TUpdate>(
  opts: CrudOptions<TCreate, TUpdate>
): Router {
  const router = Router();
  const { model, createSchema, updateSchema, listFilter, name, readonlyDelete } = opts;

  // GET / — lista
  router.get("/", async (req, res, next) => {
    try {
      const extra = listFilter ? listFilter(req.query as Record<string, string | undefined>) : {};
      const filter = { deletedAt: null, ...extra };
      const items = await model.find(filter).sort({ createdAt: -1 }).limit(500).lean();
      // .lean() no aplica toJSON transform → limpiar _id/__v manualmente
      const sanitized = items.map((doc: Record<string, unknown>) => {
        const { _id, __v, ...rest } = doc as { _id: unknown; __v: unknown };
        void _id;
        void __v;
        return rest;
      });
      res.json({ items: sanitized });
    } catch (err) {
      next(err);
    }
  });

  // POST / — crea
  router.post("/", async (req, res, next) => {
    try {
      const data = createSchema.parse(req.body);
      const doc = await model.create(data);
      res.status(201).json(doc.toJSON());
    } catch (err) {
      next(err);
    }
  });

  // GET /:id — detalle
  router.get("/:id", async (req, res, next) => {
    try {
      const doc = await model.findOne({ id: req.params.id, deletedAt: null });
      if (!doc) {
        res.status(404).json({ error: { code: "NOT_FOUND", message: `${name} no encontrado` } });
        return;
      }
      res.json(doc.toJSON());
    } catch (err) {
      next(err);
    }
  });

  // PATCH /:id — update parcial
  router.patch("/:id", async (req, res, next) => {
    try {
      const data = updateSchema.parse(req.body);
      const doc = await model.findOneAndUpdate(
        { id: req.params.id, deletedAt: null },
        { $set: data },
        { new: true }
      );
      if (!doc) {
        res.status(404).json({ error: { code: "NOT_FOUND", message: `${name} no encontrado` } });
        return;
      }
      res.json(doc.toJSON());
    } catch (err) {
      next(err);
    }
  });

  // DELETE /:id — soft delete
  if (!readonlyDelete) {
    router.delete("/:id", async (req, res, next) => {
      try {
        const doc = await model.findOneAndUpdate(
          { id: req.params.id, deletedAt: null },
          { $set: { deletedAt: new Date() } },
          { new: true }
        );
        if (!doc) {
          res.status(404).json({ error: { code: "NOT_FOUND", message: `${name} no encontrado` } });
          return;
        }
        res.status(204).end();
      } catch (err) {
        next(err);
      }
    });
  }

  return router;
}

// ---- Helpers de schemas reutilizables ----

export const optionalString = z.string().trim().min(1).nullish();
export const tagsArray = z.array(z.string().trim().min(1)).default([]);
