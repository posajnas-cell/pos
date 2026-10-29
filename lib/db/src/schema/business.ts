import { boolean, index, integer, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const organizationsTable = pgTable("organizations", {
  id: serial("id").primaryKey(),
  ownerClerkId: text("owner_clerk_id").notNull().unique(),
  name: text("name").notNull().default("My Business"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const shopsTable = pgTable(
  "shops",
  {
    id: serial("id").primaryKey(),
    organizationId: integer("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    address: text("address"),
    phone: text("phone"),
    currency: text("currency").notNull().default("INR"),
    taxRateBps: integer("tax_rate_bps").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("shops_organization_id_idx").on(table.organizationId),
    uniqueIndex("shops_organization_name_idx").on(table.organizationId, table.name),
  ],
);

export const employeesTable = pgTable(
  "employees",
  {
    id: serial("id").primaryKey(),
    organizationId: integer("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
    shopId: integer("shop_id").notNull().references(() => shopsTable.id, { onDelete: "cascade" }),
    clerkUserId: text("clerk_user_id"),
    name: text("name").notNull(),
    role: text("role").notNull().default("cashier"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("employees_shop_id_idx").on(table.shopId),
    index("employees_organization_id_idx").on(table.organizationId),
    uniqueIndex("employees_shop_clerk_user_idx").on(table.shopId, table.clerkUserId),
  ],
);

export type Organization = typeof organizationsTable.$inferSelect;
export type Shop = typeof shopsTable.$inferSelect;
export type Employee = typeof employeesTable.$inferSelect;
