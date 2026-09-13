import type { FastifyPluginAsync } from "fastify";
import { eq } from "drizzle-orm";
import type { DbClient } from "../db/client.js";
import { tenants } from "../db/client.js";
import { requireAuth, requireTenantRole, writeAuditLog } from "../auth/authorize.js";
import { menuSyncBodySchema, applyMenuSync } from "../core/menu-sync.js";

const adminMenuImportRoutes: FastifyPluginAsync<{ db: DbClient }> = async (fastify, opts) => {
  const { db } = opts;

  fastify.addHook("onRequest", requireAuth(db));

  // POST /admin/tenants/:id/menu/import — gestore carica un file JSON esportato dalla cassa
  // dal pannello tenant-admin. Sostituisce l'intero catalogo del tenant (wipe+reinsert atomico).
  fastify.post(
    "/admin/tenants/:id/menu/import",
    { onRequest: [requireTenantRole(db, "owner")] },
    async (request, reply) => {
      const { id: tenantId } = request.params as { id: string };

      const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId));
      if (!tenant) return reply.status(404).send({ error: "Tenant not found" });

      const parsed = menuSyncBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "File non valido", details: parsed.error.flatten() });
      }

      const result = applyMenuSync(db, tenant.id, parsed.data);

      await writeAuditLog(db, {
        userId: request.currentUser!.id,
        tenantId: tenant.id,
        action: "menu.import",
        metadata: { ...result },
      });

      return reply.send({ ok: true, ...result });
    },
  );
};

export default adminMenuImportRoutes;
