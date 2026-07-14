import "@fastify/swagger";
import type { FastifyPluginAsync } from "fastify";
import { eq } from "@pos/db";
import { printers, productionCenters, productionCenterPrinters } from "@pos/db";
import * as net from "node:net";
import * as os from "node:os";
import { requireRole, AuthError } from "@pos/core";

const printersRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("onRequest", async (request, reply) => {
    await fastify.authenticate(request);
    try {
      requireRole(request.session!, "admin");
    } catch (err) {
      if (err instanceof AuthError) {
        return reply.status(403).send({ error: err.message });
      }
      throw err;
    }
  });

  fastify.get("/printers", {
    schema: { tags: ["printers"], summary: "List all printers" },
  }, async (_request, reply) => {
    const rows = await fastify.ctx.db.select().from(printers);
    return reply.send(rows);
  });

  fastify.get("/printers/:id/production-centers", {
    schema: { tags: ["printers"], summary: "List production centers assigned to a printer" },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const numId = parseInt(id, 10);
    const rows = await fastify.ctx.db
      .select({ id: productionCenters.id, name: productionCenters.name, color: productionCenters.color })
      .from(productionCenterPrinters)
      .innerJoin(productionCenters, eq(productionCenterPrinters.productionCenterId, productionCenters.id))
      .where(eq(productionCenterPrinters.printerId, numId));
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
      printMode?: "text" | "image";
    };
    const [row] = await fastify.ctx.db.insert(printers).values({
      name:           body.name,
      type:           body.type ?? "escpos",
      connectionType: body.connectionType ?? "network",
      host:           body.host ?? null,
      port:           body.port ?? null,
      active:         body.active ?? true,
      receiptEnabled: body.receiptEnabled ?? false,
      kitchenEnabled: body.kitchenEnabled ?? false,
      printMode:      body.printMode ?? "text",
    }).returning();
    fastify.ctx.eventBus.emit("PRINTER_CREATED", { traceId: crypto.randomUUID(), id: row!.id, timestamp: new Date() });
    return reply.status(201).send(row);
  });

  fastify.patch("/printers/:id", {
    schema: { tags: ["printers"], summary: "Update a printer" },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const numId = parseInt(id, 10);
    const body = request.body as Partial<{
      name: string;
      type: string;
      connectionType: string;
      host: string | null;
      port: number | null;
      active: boolean;
      receiptEnabled: boolean;
      kitchenEnabled: boolean;
      printMode: "text" | "image";
    }>;

    const [existing] = await fastify.ctx.db.select().from(printers).where(eq(printers.id, numId));
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
      printMode?: string;
    } = {};
    if (body.name !== undefined) update.name = body.name;
    if (body.type !== undefined) update.type = body.type;
    if (body.connectionType !== undefined) update.connectionType = body.connectionType;
    if ("host" in body) update.host = body.host ?? null;
    if ("port" in body) update.port = body.port ?? null;
    if (body.active !== undefined) update.active = body.active;
    if (body.receiptEnabled !== undefined) update.receiptEnabled = body.receiptEnabled;
    if (body.kitchenEnabled !== undefined) update.kitchenEnabled = body.kitchenEnabled;
    if (body.printMode !== undefined) update.printMode = body.printMode;

    if (Object.keys(update).length > 0) {
      await fastify.ctx.db.update(printers).set(update).where(eq(printers.id, numId));
    }
    const [row] = await fastify.ctx.db.select().from(printers).where(eq(printers.id, numId));
    fastify.ctx.eventBus.emit("PRINTER_UPDATED", { traceId: crypto.randomUUID(), id: numId, timestamp: new Date() });
    return reply.send(row);
  });

  fastify.get("/printers/discover/subnet", {
    schema: { tags: ["printers"], summary: "Return the auto-detected local subnet" },
  }, async (_request, reply) => {
    const subnet = getLocalSubnet();
    return reply.send({ subnet });
  });

  fastify.post("/printers/discover", {
    schema: { tags: ["printers"], summary: "Discover ESC/POS printers on the local network" },
  }, async (request, reply) => {
    const body = request.body as { subnet?: string } | null;
    const subnet = body?.subnet?.trim() || getLocalSubnet();
    if (!subnet) return reply.status(422).send({ error: "Subnet locale non rilevabile" });

    if (!/^\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(subnet)) {
      return reply.status(400).send({ error: "Formato subnet non valido (es. 192.168.1)" });
    }

    const PORTS = [9100, 515];
    const TIMEOUT_MS = 600;
    const ips = expandSubnet(subnet);

    const results = await Promise.all(
      ips.flatMap((ip) =>
        PORTS.map((port) =>
          probeTcp(ip, port, TIMEOUT_MS).then((ok) => (ok ? { host: ip, port } : null))
        )
      )
    );

    const found = results.filter((r): r is { host: string; port: number } => r !== null);
    return reply.send({ subnet, found });
  });

  fastify.delete("/printers/:id", {
    schema: { tags: ["printers"], summary: "Delete a printer" },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const numId = parseInt(id, 10);
    await fastify.ctx.db.delete(printers).where(eq(printers.id, numId));
    fastify.ctx.eventBus.emit("PRINTER_DELETED", { traceId: crypto.randomUUID(), id: numId, timestamp: new Date() });
    return reply.status(204).send();
  });

  fastify.post("/printers/:id/test-print", {
    schema: { tags: ["printers"], summary: "Test print on a printer", body: {} },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const numId = parseInt(id, 10);
    const [printer] = await fastify.ctx.db.select().from(printers).where(eq(printers.id, numId));
    if (!printer) return reply.status(404).send({ error: "Not found" });

    const result = await fastify.ctx.printerService.printDirect({
      printerId: printer.id,
      content: `## Test stampa\n\nStampante: ${printer.name}\nOra: ${new Date().toLocaleString("it-IT")}\n`,
      type: "receipt",
      ...(printer.host && printer.port
        ? { printerConfig: { host: printer.host, port: printer.port } }
        : {}),
    });

    return reply.send(result);
  });
};

export default printersRoutes;

function getLocalSubnet(): string | null {
  const ifaces = os.networkInterfaces();
  for (const list of Object.values(ifaces)) {
    for (const iface of list ?? []) {
      if (iface.family === "IPv4" && !iface.internal) {
        const parts = iface.address.split(".");
        if (parts.length === 4) return `${parts[0]}.${parts[1]}.${parts[2]}`;
      }
    }
  }
  return null;
}

function expandSubnet(subnet: string): string[] {
  return Array.from({ length: 254 }, (_, i) => `${subnet}.${i + 1}`);
}

function probeTcp(host: string, port: number, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let done = false;
    const finish = (result: boolean) => {
      if (done) return;
      done = true;
      socket.destroy();
      resolve(result);
    };
    socket.setTimeout(timeoutMs);
    socket.on("connect", () => finish(true));
    socket.on("timeout", () => finish(false));
    socket.on("error", () => finish(false));
    socket.connect(port, host);
  });
}
