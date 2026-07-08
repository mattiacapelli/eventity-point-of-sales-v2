import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema.js";
import { runMigrations } from "./migrate.js";

export function createDb(dbPath: string) {
  runMigrations(dbPath);
  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  return drizzle(sqlite, { schema });
}

export type DbClient = ReturnType<typeof createDb>;
export { eq, and, inArray, desc } from "drizzle-orm";
export * from "./schema.js";
