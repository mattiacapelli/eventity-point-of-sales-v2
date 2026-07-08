import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import type { DbClient } from "../db/client.js";
import { users } from "../db/client.js";
import type { Config } from "../config.js";

export async function seedSuperAdmin(db: DbClient, config: Config): Promise<void> {
  const existing = db.select().from(users).all();
  if (existing.length > 0) return;

  if (!config.superAdminEmail || !config.superAdminPassword) {
    console.warn(
      "[seed-superadmin] Nessun utente presente e SUPERADMIN_EMAIL/SUPERADMIN_PASSWORD non impostate: skip bootstrap.",
    );
    return;
  }

  const passwordHash = await bcrypt.hash(config.superAdminPassword, 12);
  db.insert(users)
    .values({
      id: randomUUID(),
      email: config.superAdminEmail,
      passwordHash,
      isSuperAdmin: true,
      active: true,
      createdAt: Date.now(),
    })
    .run();

  console.log(`[seed-superadmin] Creato utente super-admin: ${config.superAdminEmail}`);
}
