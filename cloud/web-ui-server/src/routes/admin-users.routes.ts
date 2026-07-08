import type { FastifyPluginAsync } from "fastify";
import { randomUUID, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { eq, and } from "drizzle-orm";
import type { DbClient } from "../db/client.js";
import { users, tenantUsers } from "../db/client.js";
import { requireAuth, requireTenantRole, writeAuditLog, type TenantRole } from "../auth/authorize.js";

function generateTempPassword(): string {
  return randomBytes(9).toString("base64url");
}

const adminUsersRoutes: FastifyPluginAsync<{ db: DbClient }> = async (fastify, opts) => {
  const { db } = opts;

  fastify.addHook("onRequest", requireAuth(db));

  fastify.get(
    "/admin/tenants/:id/users",
    { onRequest: [requireTenantRole(db, "operator")] },
    async (request, reply) => {
      const { id: tenantId } = request.params as { id: string };
      const rows = await db
        .select({
          id: tenantUsers.id,
          userId: users.id,
          email: users.email,
          role: tenantUsers.role,
          createdAt: tenantUsers.createdAt,
        })
        .from(tenantUsers)
        .innerJoin(users, eq(tenantUsers.userId, users.id))
        .where(eq(tenantUsers.tenantId, tenantId));
      return reply.send(rows);
    },
  );

  fastify.post(
    "/admin/tenants/:id/users/invite",
    { onRequest: [requireTenantRole(db, "owner")] },
    async (request, reply) => {
      const { id: tenantId } = request.params as { id: string };
      const body = request.body as { email?: string; role?: TenantRole };
      if (!body.email?.trim() || (body.role !== "owner" && body.role !== "operator")) {
        return reply.status(400).send({ error: "email and role (owner|operator) are required" });
      }
      const email = body.email.trim();

      let [user] = await db.select().from(users).where(eq(users.email, email));
      let tempPassword: string | undefined;

      if (!user) {
        tempPassword = generateTempPassword();
        const passwordHash = await bcrypt.hash(tempPassword, 12);
        const id = randomUUID();
        await db.insert(users).values({
          id,
          email,
          passwordHash,
          isSuperAdmin: false,
          active: true,
          createdAt: Date.now(),
        });
        [user] = await db.select().from(users).where(eq(users.id, id));
      }

      const [existingMembership] = await db
        .select()
        .from(tenantUsers)
        .where(and(eq(tenantUsers.tenantId, tenantId), eq(tenantUsers.userId, user!.id)));

      if (existingMembership) {
        return reply.status(409).send({ error: "User already has a role on this tenant" });
      }

      await db.insert(tenantUsers).values({
        id: randomUUID(),
        tenantId,
        userId: user!.id,
        role: body.role,
        createdAt: Date.now(),
      });

      await writeAuditLog(db, {
        userId: request.currentUser!.id,
        tenantId,
        action: "tenant_user.invite",
        metadata: { email, role: body.role },
      });

      return reply.status(201).send({
        userId: user!.id,
        email: user!.email,
        role: body.role,
        ...(tempPassword ? { tempPassword } : {}),
      });
    },
  );

  fastify.delete(
    "/admin/tenants/:id/users/:userId",
    { onRequest: [requireTenantRole(db, "owner")] },
    async (request, reply) => {
      const { id: tenantId, userId } = request.params as { id: string; userId: string };
      const currentUser = request.currentUser!;

      const [membership] = await db
        .select()
        .from(tenantUsers)
        .where(and(eq(tenantUsers.tenantId, tenantId), eq(tenantUsers.userId, userId)));
      if (!membership) return reply.status(404).send({ error: "Not found" });

      if (!currentUser.isSuperAdmin && membership.role === "owner") {
        return reply.status(403).send({ error: "Owners cannot remove other owners" });
      }

      await db.delete(tenantUsers).where(eq(tenantUsers.id, membership.id));
      await writeAuditLog(db, {
        userId: currentUser.id,
        tenantId,
        action: "tenant_user.remove",
        metadata: { removedUserId: userId, role: membership.role },
      });
      return reply.status(204).send();
    },
  );
};

export default adminUsersRoutes;
