import { Schema } from "mongoose";
import { randomUUID } from "node:crypto";

/**
 * Opciones por defecto para todos los Schemas:
 * - `timestamps`: createdAt / updatedAt automáticos.
 * - `versionKey: false`: descarta `__v`, ruido en respuestas API.
 * - `toJSON`/`toObject` con `virtuals: true` para que `id` salga junto a otros campos.
 */
export const baseSchemaOptions = {
  timestamps: true,
  versionKey: false,
  toJSON: {
    virtuals: true,
    transform: (_doc: unknown, ret: Record<string, unknown>) => {
      // _id existe siempre, pero preferimos exponer `id` (UUID propio).
      delete ret._id;
      return ret;
    },
  },
  toObject: { virtuals: true },
} as const;

/**
 * Campo `id` UUID v4 — usado como identificador estable de cara al frontend y al
 * grafo xyflow (los IDs xyflow deben ser strings simples, no ObjectId).
 * El `_id` interno de Mongo se mantiene para joins.
 *
 * Tipado como objeto plano (no `SchemaDefinitionProperty`) para permitir spread
 * en el campo `id` de cada schema sin pelearse con los genéricos de Mongoose.
 */
export const uuidIdField = {
  type: String,
  required: true,
  unique: true,
  index: true,
  default: () => randomUUID(),
} as const;

/**
 * Soft-delete: en lugar de borrar, marcamos `deletedAt`. Los queries por defecto
 * deberían filtrar `{ deletedAt: null }` (cada feature aplica su filtro).
 */
export const softDeleteField = {
  type: Date,
  default: null,
  index: true,
} as const;

/**
 * Aplica el field id UUID + el soft delete a un Schema.
 * Uso: `applyBaseSchema(MyEntitySchema)`.
 */
export function applyBaseSchema(schema: Schema): void {
  schema.add({
    id: uuidIdField,
    deletedAt: softDeleteField,
  });
}

/** Color hex normalizado para etiquetas/UI. Permite #RGB o #RRGGBB. */
export const colorHexField = {
  type: String,
  match: /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/,
} as const;
