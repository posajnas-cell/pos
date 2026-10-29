import { date, index, integer, jsonb, numeric, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { employeesTable, organizationsTable, shopsTable } from "./business";

export const salesTable = pgTable(
  "sales",
  {
    id: serial("id").primaryKey(),
    organizationId: integer("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
    shopId: integer("shop_id").notNull().references(() => shopsTable.id, { onDelete: "cascade" }),
    employeeId: integer("employee_id").notNull().references(() => employeesTable.id),
    idempotencyKey: text("idempotency_key").notNull().unique(),
    billNumber: text("bill_number").notNull().unique(),
    orderType: text("order_type").notNull(),
    paymentMethod: text("payment_method").notNull(),
    subtotalCents: integer("subtotal_cents").notNull(),
    discountCents: integer("discount_cents").notNull().default(0),
    taxCents: integer("tax_cents").notNull().default(0),
    parcelCents: integer("parcel_cents").notNull().default(0),
    totalCents: integer("total_cents").notNull(),
    status: text("status").notNull().default("completed"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("sales_shop_created_at_idx").on(table.shopId, table.createdAt),
    index("sales_employee_created_at_idx").on(table.employeeId, table.createdAt),
    index("sales_organization_created_at_idx").on(table.organizationId, table.createdAt),
  ],
);

export const saleItemsTable = pgTable(
  "sale_items",
  {
    id: serial("id").primaryKey(),
    saleId: integer("sale_id").notNull().references(() => salesTable.id, { onDelete: "cascade" }),
    productId: integer("product_id").notNull(),
    productName: text("product_name").notNull(),
    quantity: integer("quantity").notNull(),
    unitPriceCents: integer("unit_price_cents").notNull(),
    discountCents: integer("discount_cents").notNull().default(0),
    parcelCents: integer("parcel_cents").notNull().default(0),
    lineTotalCents: integer("line_total_cents").notNull(),
  },
  (table) => [index("sale_items_sale_id_idx").on(table.saleId)],
);

export const expensesTable = pgTable(
  "expenses",
  {
    id: serial("id").primaryKey(),
    organizationId: integer("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
    shopId: integer("shop_id").notNull().references(() => shopsTable.id, { onDelete: "cascade" }),
    employeeId: integer("employee_id").notNull().references(() => employeesTable.id),
    expenseDate: date("expense_date", { mode: "string" }).notNull(),
    supplier: text("supplier"),
    invoiceReference: text("invoice_reference"),
    paymentMethod: text("payment_method").notNull(),
    note: text("note"),
    totalCents: integer("total_cents").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("expenses_shop_date_idx").on(table.shopId, table.expenseDate),
    index("expenses_organization_date_idx").on(table.organizationId, table.expenseDate),
  ],
);

export const expenseItemsTable = pgTable(
  "expense_items",
  {
    id: serial("id").primaryKey(),
    expenseId: integer("expense_id").notNull().references(() => expensesTable.id, { onDelete: "cascade" }),
    categoryName: text("category_name").notNull(),
    productName: text("product_name").notNull(),
    quantity: numeric("quantity", { precision: 12, scale: 3, mode: "number" }).notNull(),
    unit: text("unit").notNull(),
    unitPriceCents: integer("unit_price_cents").notNull(),
    lineTotalCents: integer("line_total_cents").notNull(),
  },
  (table) => [index("expense_items_expense_id_idx").on(table.expenseId)],
);

export const auditLogsTable = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  shopId: integer("shop_id").references(() => shopsTable.id, { onDelete: "set null" }),
  actorClerkId: text("actor_clerk_id").notNull(),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: integer("entity_id").notNull(),
  details: jsonb("details").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const shiftsTable = pgTable(
  "shifts",
  {
    id: serial("id").primaryKey(),
    organizationId: integer("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
    shopId: integer("shop_id").notNull().references(() => shopsTable.id, { onDelete: "cascade" }),
    employeeId: integer("employee_id").notNull().references(() => employeesTable.id),
    openingCashCents: integer("opening_cash_cents").notNull(),
    closingCashCents: integer("closing_cash_cents"),
    expectedCashCents: integer("expected_cash_cents"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
  },
  (table) => [index("shifts_shop_started_at_idx").on(table.shopId, table.startedAt)],
);
