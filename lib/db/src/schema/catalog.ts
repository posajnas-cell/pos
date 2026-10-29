import { boolean, index, integer, pgTable, serial, text, uniqueIndex } from "drizzle-orm/pg-core";
import { organizationsTable, shopsTable } from "./business";

export const categoriesTable = pgTable(
  "categories",
  {
    id: serial("id").primaryKey(),
    organizationId: integer("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
    shopId: integer("shop_id").notNull().references(() => shopsTable.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    color: text("color").notNull().default("#157a68"),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
  },
  (table) => [
    index("categories_shop_id_idx").on(table.shopId),
    uniqueIndex("categories_shop_name_idx").on(table.shopId, table.name),
  ],
);

export const productsTable = pgTable(
  "products",
  {
    id: serial("id").primaryKey(),
    organizationId: integer("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
    shopId: integer("shop_id").notNull().references(() => shopsTable.id, { onDelete: "cascade" }),
    categoryId: integer("category_id").references(() => categoriesTable.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    description: text("description"),
    priceCents: integer("price_cents").notNull(),
    sku: text("sku"),
    imageUrl: text("image_url"),
    isAvailable: boolean("is_available").notNull().default(true),
    parcelType: text("parcel_type").notNull().default("none"),
    parcelValue: integer("parcel_value").notNull().default(0),
  },
  (table) => [
    index("products_shop_id_idx").on(table.shopId),
    index("products_category_id_idx").on(table.categoryId),
  ],
);

export type Category = typeof categoriesTable.$inferSelect;
export type Product = typeof productsTable.$inferSelect;
