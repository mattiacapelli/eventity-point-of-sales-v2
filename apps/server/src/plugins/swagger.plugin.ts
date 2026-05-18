import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";

const swaggerPlugin: FastifyPluginAsync = async (fastify) => {
  await fastify.register(swagger, {
    openapi: {
      openapi: "3.0.3",
      info: {
        title: "Eventity POS API",
        description: "Offline-first POS platform REST API",
        version: "0.1.0",
      },
      servers: [{ url: "http://localhost:3000", description: "Local dev" }],
      tags: [
        { name: "system", description: "Health, modules, event debug" },
        { name: "auth", description: "Login, logout, session" },
        { name: "orders", description: "Order management" },
        { name: "payments", description: "Payment management" },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT",
          },
        },
      },
    },
  });

  await fastify.register(swaggerUi, {
    routePrefix: "/docs",
    uiConfig: {
      docExpansion: "list",
      deepLinking: true,
    },
  });
};

export default fp(swaggerPlugin, { name: "swagger" });
