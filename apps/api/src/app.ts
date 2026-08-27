import Fastify, { type FastifyInstance, type FastifyServerOptions } from "fastify";
import { registerErrorHandling } from "./http/errors.js";
import type { PrismaClient } from "./generated/prisma/client.js";

export interface AppOptions {
  prisma: PrismaClient;
  /** Fastify logger option. Defaults to off so tests stay quiet; `server.ts` turns it on. */
  logger?: FastifyServerOptions["logger"];
}

/**
 * Builds a fully configured Fastify instance that is not yet listening.
 * The caller owns the Prisma client's lifecycle.
 */
export function buildApp({ prisma, logger = false }: AppOptions): FastifyInstance {
  const app = Fastify({ logger });
  app.decorate("prisma", prisma);
  registerErrorHandling(app);
  return app;
}

declare module "fastify" {
  interface FastifyInstance {
    prisma: PrismaClient;
  }
}
