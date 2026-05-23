import fp from "fastify-plugin";
import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { AuthService } from "@pos/core";
import type { SessionContext } from "@pos/shared-types";

declare module "fastify" {
  interface FastifyInstance {
    authService: AuthService;
    authenticate: (request: FastifyRequest) => Promise<void>;
  }
  interface FastifyRequest {
    session: SessionContext | null;
  }
}

function makeHttpError(message: string, statusCode: number): Error & { statusCode: number } {
  const err = new Error(message) as Error & { statusCode: number };
  err.statusCode = statusCode;
  return err;
}

const authPlugin: FastifyPluginAsync = async (fastify) => {
  const { ctx } = fastify;

  const authService = new AuthService(ctx.db, ctx.config.sessionTtlSeconds);
  fastify.decorate("authService", authService);

  fastify.decorateRequest("session", null);

  fastify.decorate("authenticate", async (request: FastifyRequest) => {
    const authHeader = request.headers.authorization;
    if (authHeader === undefined || !authHeader.startsWith("Bearer ")) {
      throw makeHttpError("Missing or invalid Authorization header", 401);
    }

    const token = authHeader.slice(7);
    try {
      const session = await authService.validateToken(token);
      request.session = session;
    } catch {
      throw makeHttpError("Invalid or expired session", 401);
    }
  });

  setInterval(() => {
    void authService.purgeExpiredSessions().catch(() => {});
  }, 60 * 60 * 1000);
};

export default fp(authPlugin, {
  name: "auth",
  dependencies: ["core-context"],
});
