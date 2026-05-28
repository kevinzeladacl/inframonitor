import mongoose from "mongoose";
import { buildMongoUri, env } from "./env.js";
import { logger } from "../utils/logger.js";

export async function connectMongo(): Promise<void> {
  const uri = buildMongoUri();
  mongoose.set("strictQuery", true);

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5_000,
      maxPoolSize: 20,
    });
    logger.info({ db: env.MONGO.DB }, "✅ MongoDB conectado");
  } catch (err) {
    logger.error({ err }, "❌ No se pudo conectar a MongoDB");
    throw err;
  }
}

export async function disconnectMongo(): Promise<void> {
  await mongoose.disconnect();
}

export function mongoStatus(): "ok" | "down" {
  return mongoose.connection.readyState === 1 ? "ok" : "down";
}
