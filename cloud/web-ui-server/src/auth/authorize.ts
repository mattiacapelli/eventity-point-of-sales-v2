import { randomUUID } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import { eq, and } from "drizzle-orm";
import type { DbClient } from "../db/client.js";
import { users, tenantUsers, auditLog } from "../db/client.js";

export interface CurrentUser {
  id: string;
  email: string;
  isSuperAdmin: boolean;
}

declare module "fastify" {
  interface FastifyRequest {
    currentUser?: CurrentUser;
  }
}

export type TenantRole = "operator" | "owner";

const ROLE_RANK: Record<TenantRole, number> = { operator: 1, owner: 2 };

export function requireAuth(db: DbClient) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify();
    } catch {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const payload = request.user as { userId?: string };
    if (!payload.userId) return reply.status(401).send({ error: "Unauthorized" });

    const [user] = await db.select().from(users).where(eq(users.id, payload.userId));
    if (!user || !user.active) return reply.status(401).send({ error: "Unauthorized" });

    request.currentUser = { id: user.id, email: user.email, isSuperAdmin: user.isSuperAdmin };
  };
}

export function requireTenantRole(db: DbClient, minRole: TenantRole) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const currentUser = request.currentUser;
    if (!currentUser) return reply.status(401).send({ error: "Unauthorized" });
    if (currentUser.isSuperAdmin) return;

    const { id: tenantId } = request.params as { id?: string };
    if (!tenantId) return reply.status(400).send({ error: "Missing tenant id" });

    const [membership] = await db
      .select()
      .from(tenantUsers)
      .where(and(eq(tenantUsers.tenantId, tenantId), eq(tenantUsers.userId, currentUser.id)));

    if (!membership) return reply.status(403).send({ error: "Forbidden" });
    if (ROLE_RANK[membership.role as TenantRole] < ROLE_RANK[minRole]) {
      return reply.status(403).send({ error: "Forbidden" });
    }
  };
}

export function requireSuperAdmin() {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.currentUser?.isSuperAdmin) {
      return reply.status(403).send({ error: "Forbidden" });
    }
  };
}

export async function writeAuditLog(
  db: DbClient,
  entry: { userId: string; tenantId?: string | null; action: string; metadata?: Record<string, unknown> },
): Promise<void> {
  await db.insert(auditLog).values({
    id: randomUUID(),
    userId: entry.userId,
    tenantId: entry.tenantId ?? null,
    action: entry.action,
    metadataJson: entry.metadata ? JSON.stringify(entry.metadata) : null,
    createdAt: Date.now(),
  });
}
