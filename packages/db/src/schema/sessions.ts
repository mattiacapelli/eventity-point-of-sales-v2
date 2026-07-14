import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { users } from "./users.js";

export const sessions = sqliteTable("sessions", {
  id:        integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  userId:    integer("user_id", { mode: "number" }).notNull().references(() => users.id, { onDelete: "cascade" }),
  token:     text("token").notNull().unique(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
});

export type DbSession = typeof sessions.$inferSelect;
export type DbSessionInsert = typeof sessions.$inferInsert;
