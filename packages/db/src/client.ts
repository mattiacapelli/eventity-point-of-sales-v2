import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema/index.js";

export type DbClient = ReturnType<typeof createDbClient>;

export function createDbClient(dbPath: string = "./pos.db"): ReturnType<typeof drizzle<typeof schema>> {
  const sqlite = new Database(dbPath);

  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("synchronous = NORMAL");

  return drizzle(sqlite, { schema });
}

export function createDbClientWithHandle(dbPath: string = "./pos.db"): {
  db: ReturnType<typeof drizzle<typeof schema>>;
  sqlite: Database.Database;
} {
  const sqlite = new Database(dbPath);

  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("synchronous = NORMAL");

  return { db: drizzle(sqlite, { schema }), sqlite };
}

let _client: DbClient | null = null;

export function getDbClient(dbPath?: string): DbClient {
  if (_client === null) {
    _client = createDbClient(dbPath);
  }
  return _client;
}
