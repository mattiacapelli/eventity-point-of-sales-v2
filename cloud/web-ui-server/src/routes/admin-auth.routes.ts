import type { FastifyPluginAsync } from "fastify";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import type { DbClient } from "../db/client.js";
import { users } from "../db/client.js";
import { requireAuth } from "../auth/authorize.js";

const adminAuthRoutes: FastifyPluginAsync<{ db: DbClient }> = async (fastify, opts) => {
  const { db } = opts;

  fastify.post(
    "/admin/login",
    { config: { rateLimit: { max: 5, timeWindow: "15 minutes" } } },
    async (request, reply) => {
      const body = request.body as { email?: string; password?: string };
      if (!body.email || !body.password) {
        return reply.status(400).send({ error: "email and password are required" });
      }

      const [user] = await db.select().from(users).where(eq(users.email, body.email));
      if (!user || !user.active) {
        return reply.status(401).send({ error: "Invalid credentials" });
      }

      const valid = await bcrypt.compare(body.password, user.passwordHash);
      if (!valid) {
        return reply.status(401).send({ error: "Invalid credentials" });
      }

      const token = await reply.jwtSign({ userId: user.id }, { expiresIn: "12h" });
      return reply.send({ token });
    },
  );

  fastify.get(
    "/admin/me",
    { onRequest: [requireAuth(db)] },
    async (request, reply) => {
      return reply.send(request.currentUser);
    },
  );
};

export default adminAuthRoutes;
