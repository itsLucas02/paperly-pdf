import { pgTable, uuid, text, integer, timestamp, jsonb } from "drizzle-orm/pg-core";

export const workspaces = pgTable("paperly_workspaces", {
  id: uuid("id").primaryKey(),
  name: text("name").notNull().default("My workspace"),
  favorites: jsonb("favorites").$type<string[]>().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const pdfJobs = pgTable("paperly_jobs", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  toolId: text("tool_id").notNull(),
  fileName: text("file_name").notNull(),
  inputSize: integer("input_size").notNull(),
  outputSize: integer("output_size").notNull(),
  pageCount: integer("page_count").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const feedback = pgTable("paperly_feedback", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  message: text("message").notNull(),
  email: text("email"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
