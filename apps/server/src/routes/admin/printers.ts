import "@fastify/swagger";
import type { FastifyPluginAsync } from "fastify";
import { eq } from "@pos/db";
import { printers } from "@pos/db";
import { randomUUID } from "node:crypto";

const printersRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/printers", {
    schema: { tags: ["printers"], summary: "List all printers" },
  }, async (_request, reply) => {
    const rows = await fastify.ctx.db.select().from(printers);
    return reply.send(rows);
  });

  fastify.post("/printers", {
    schema: { tags: ["printers"], summary: "Create a printer" },
  }, async (request, reply) => {
    const body = request.body as {
      name: string;
      type?: string;
      connectionType?: string;
      host?: string;
      port?: number;
      active?: boolean;
      receiptEnabled?: boolean;
      kitchenEnabled?: boolean;
    };
    const id = randomUUID();
    await fastify.ctx.db.insert(printers).values({
      id,
      name:           body.name,
      type:           body.type ?? "escpos",
      connectionType: body.connectionType ?? "network",
      host:           body.host ?? null,
      port:           body.port ?? null,
      active:         body.active ?? true,
      receiptEnabled: body.receiptEnabled ?? false,
      kitchenEnabled: body.kitchenEnabled ?? false,
    });
    const [row] = await fastify.ctx.db.select().from(printers).where(eq(printers.id, id));
    return reply.status(201).send(row);
  });

  fastify.patch("/printers/:id", {
    schema: { tags: ["printers"], summary: "Update a printer" },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as Partial<{
      name: string;
      type: string;
      connectionType: string;
      host: string | null;
      port: number | null;
      active: boolean;
      receiptEnabled: boolean;
      kitchenEnabled: boolean;
    }>;

    const [existing] = await fastify.ctx.db.select().from(printers).where(eq(printers.id, id));
    if (!existing) return reply.status(404).send({ error: "Not found" });

    const update: {
      name?: string;
      type?: string;
      connectionType?: string;
      host?: string | null;
      port?: number | null;
      active?: boolean;
      receiptEnabled?: boolean;
      kitchenEnabled?: boolean;
    } = {};
    if (body.name !== undefined) update.name = body.name;
    if (body.type !== undefined) update.type = body.type;
    if (body.connectionType !== undefined) update.connectionType = body.connectionType;
    if ("host" in body) update.host = body.host ?? null;
    if ("port" in body) update.port = body.port ?? null;
    if (body.active !== undefined) update.active = body.active;
    if (body.receiptEnabled !== undefined) update.receiptEnabled = body.receiptEnabled;
    if (body.kitchenEnabled !== undefined) update.kitchenEnabled = body.kitchenEnabled;

    if (Object.keys(update).length > 0) {
      await fastify.ctx.db.update(printers).set(update).where(eq(printers.id, id));
    }
    const [row] = await fastify.ctx.db.select().from(printers).where(eq(printers.id, id));
    return reply.send(row);
  });

  fastify.delete("/printers/:id", {
    schema: { tags: ["printers"], summary: "Delete a printer" },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await fastify.ctx.db.delete(printers).where(eq(printers.id, id));
    return reply.status(204).send();
  });

  fastify.post("/printers/:id/test-print", {
    schema: { tags: ["printers"], summary: "Test print on a printer" },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const [printer] = await fastify.ctx.db.select().from(printers).where(eq(printers.id, id));
    if (!printer) return reply.status(404).send({ error: "Not found" });
    // Mock adapter — in production this would call the PrinterService
    fastify.log.info(`[test-print] printer=${printer.name} host=${printer.host ?? "local"}`);
    return reply.send({ success: true, message: `Test print sent to ${printer.name}` });
  });
};

export default printersRoutes;
