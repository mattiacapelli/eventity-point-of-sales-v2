import type { FastifyPluginAsync } from "fastify";
import type { Config } from "../config.js";

const adminAuthRoutes: FastifyPluginAsync<{ config: Config }> = async (fastify, opts) => {
  const { config } = opts;

  fastify.post("/admin/login", async (request, reply) => {
    const body = request.body as { username?: string; password?: string };
    if (body.username !== config.adminUsername || body.password !== config.adminPassword) {
      return reply.status(401).send({ error: "Invalid credentials" });
    }
    const token = await reply.jwtSign({ sub: config.adminUsername, role: "admin" }, { expiresIn: "12h" });
    return reply.send({ token });
  });
};

export default adminAuthRoutes;
