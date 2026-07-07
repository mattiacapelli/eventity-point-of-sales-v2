import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "@pos/db";
import { runMigrations } from "@pos/db";
import type { DbClient } from "@pos/db";

export function createTestDb(): { db: DbClient; cleanup: () => void } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pos-test-"));
  const dbPath = path.join(dir, "test.db");
  runMigrations(dbPath);
  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  const db = drizzle(sqlite, { schema }) as unknown as DbClient;
  return { db, cleanup: () => { try { sqlite.close(); } catch { /**/ } } };
}
