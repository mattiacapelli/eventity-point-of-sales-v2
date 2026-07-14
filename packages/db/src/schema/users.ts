import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id:        integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  name:      text("name").notNull(),
  username:  text("username").notNull().unique(),
  role: text("role", {
    enum: ["admin", "cashier", "kitchen", "waiter", "viewer"],
  }).notNull(),
  pin:       text("pin"),
  active:    integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export type DbUser = typeof users.$inferSelect;
export type DbUserInsert = typeof users.$inferInsert;
