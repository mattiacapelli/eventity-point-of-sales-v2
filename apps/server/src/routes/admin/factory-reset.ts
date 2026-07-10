import type { FastifyPluginAsync } from "fastify";
import {
  ne,
  users,
  sessions, processedEvents,
  categories, products, productionCenters, productionCenterCategories, productionCenterPrinters,
  paymentMethods, printers, receiptTemplates, kitchenTemplates, shiftReportTemplates,
  shifts, appSettings, modules, receiptCounters,
  terminals, terminalPrinters, terminalCategories, productGridLayouts,
  orders, orderItems, payments,
  optionGroups, options, orderItemOptions,
  inventoryItems, inventoryMovements,
  productIngredients,
} from "@pos/db";
import { requireRole } from "@pos/core";

const RESET_PASSWORD = "EventityPosResetAll!";

const factoryResetRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("onRequest", async (request) => {
    await fastify.authenticate(request);
  });

  fastify.post("/admin/factory-reset", {
    schema: {
      tags: ["admin"],
      summary: "Factory reset — wipes all data except the first admin user",
      body: {
        type: "object",
        required: ["password"],
        properties: { password: { type: "string" } },
      },
    },
  }, async (request, reply) => {
    requireRole(request.session!, "admin");

    const { password } = request.body as { password: string };
    if (password !== RESET_PASSWORD) {
      return reply.status(403).send({ error: "Password non valida" });
    }

    const db = fastify.ctx.db;

    // Delete in dependency order (children before parents)
    await db.delete(orderItemOptions);
    await db.delete(orderItems);
    await db.delete(payments);
    await db.delete(orders);
    await db.delete(shifts);
    await db.delete(receiptCounters);
    await db.delete(terminalCategories);
    await db.delete(terminalPrinters);
    await db.delete(terminals);
    await db.delete(productionCenterCategories);
    await db.delete(productionCenterPrinters);
    await db.delete(productionCenters);
    await db.delete(productGridLayouts);
    await db.delete(productIngredients);
    await db.delete(inventoryMovements);
    await db.delete(inventoryItems);
    await db.delete(options);
    await db.delete(optionGroups);
    await db.delete(products);
    await db.delete(categories);
    await db.delete(paymentMethods);
    await db.delete(printers);
    await db.delete(receiptTemplates);
    await db.delete(kitchenTemplates);
    await db.delete(shiftReportTemplates);
    await db.delete(appSettings);
    await db.delete(modules);
    await db.delete(sessions);
    await db.delete(processedEvents);

    // Keep only the user making the request, delete all others
    const userId = request.session!.userId;
    await db.delete(users).where(ne(users.id, userId));

    return reply.send({ ok: true });
  });
};

export default factoryResetRoutes;
