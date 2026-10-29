import {
  and,
  asc,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  lte,
  sql,
} from "drizzle-orm";
import { Router, type IRouter, type Request, type RequestHandler } from "express";
import {
  db,
  auditLogsTable,
  categoriesTable,
  employeesTable,
  expenseItemsTable,
  expensesTable,
  organizationsTable,
  productsTable,
  saleItemsTable,
  salesTable,
  shopsTable,
} from "@workspace/db";
import {
  CreateCategoryBody,
  CreateCategoryResponse,
  CreateEmployeeBody,
  CreateEmployeeResponse,
  CreateExpenseBody,
  CreateExpenseResponse,
  CreateProductBody,
  CreateProductResponse,
  CreateShopBody,
  CreateShopResponse,
  CompleteSaleBody,
  CompleteSaleResponse,
  GetDashboardQueryParams,
  GetDashboardResponse,
  GetExpensesReportQueryParams,
  GetExpensesReportResponse,
  GetSalesReportQueryParams,
  GetSalesReportResponse,
  GetWorkspaceResponse,
  ListCategoriesQueryParams,
  ListCategoriesResponse,
  ListEmployeesQueryParams,
  ListEmployeesResponse,
  ListExpensesQueryParams,
  ListExpensesResponse,
  ListProductsQueryParams,
  ListProductsResponse,
  ListSalesQueryParams,
  ListSalesResponse,
  ListShopsResponse,
  UpdateCategoryBody,
  UpdateCategoryParams,
  UpdateCategoryResponse,
  UpdateProductBody,
  UpdateProductParams,
  UpdateProductResponse,
  UpdateShopBody,
  UpdateShopParams,
  UpdateShopResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

function getLocalUserId(req: Parameters<RequestHandler>[0]): string {
  const header = req.headers["x-user-id"] || req.headers["x-local-user-id"];
  if (typeof header === "string" && header.trim()) {
    return header.trim();
  }
  return "local_admin";
}

const requireAuth: RequestHandler = (_req, _res, next) => {
  // Local mode: automatically authenticated with local_admin or header
  next();
};

router.use(requireAuth);

function clerkId(req: Parameters<RequestHandler>[0]): string {
  return getLocalUserId(req);
}

function dateOnly(value: string | Date): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return value.slice(0, 10);
}

function dateBound(value: string | Date, end = false): Date {
  const day = dateOnly(value);
  return new Date(`${day}T${end ? "23:59:59.999" : "00:00:00.000"}+05:30`);
}

function parseDateQuery(query: Request["query"]): Record<string, unknown> {
  const result: Record<string, unknown> = { ...query };
  for (const key of ["from", "to"] as const) {
    const value = result[key];
    if (typeof value === "string" && value.length > 0) {
      result[key] = new Date(value);
    }
  }
  return result;
}

function todayInIndia(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

async function ensureWorkspace(userId: string) {
  return db.transaction(async (tx) => {
    let [organization] = await tx
      .select()
      .from(organizationsTable)
      .where(eq(organizationsTable.ownerClerkId, userId))
      .limit(1);

    if (!organization) {
      const [created] = await tx
        .insert(organizationsTable)
        .values({ ownerClerkId: userId, name: "My Business" })
        .onConflictDoNothing()
        .returning();
      organization =
        created ??
        (
          await tx
            .select()
            .from(organizationsTable)
            .where(eq(organizationsTable.ownerClerkId, userId))
            .limit(1)
        )[0];
    }

    if (!organization) throw new Error("Could not create the business workspace.");

    const [existingShop] = await tx
      .select()
      .from(shopsTable)
      .where(eq(shopsTable.organizationId, organization.id))
      .limit(1);

    if (!existingShop) {
      const [shop] = await tx
        .insert(shopsTable)
        .values({
          organizationId: organization.id,
          name: "My first shop",
          currency: "INR",
        })
        .returning();

      await tx.insert(employeesTable).values({
        organizationId: organization.id,
        shopId: shop.id,
        clerkUserId: userId,
        name: "Owner",
        role: "owner",
      });

      const categoryRows = await tx
        .insert(categoriesTable)
        .values([
          { organizationId: organization.id, shopId: shop.id, name: "Breakfast", color: "#e8a04a", sortOrder: 0 },
          { organizationId: organization.id, shopId: shop.id, name: "Beverages", color: "#4e8c79", sortOrder: 1 },
          { organizationId: organization.id, shopId: shop.id, name: "Bakery", color: "#bb725a", sortOrder: 2 },
        ])
        .returning();
      const categoryByName = new Map(categoryRows.map((category) => [category.name, category.id]));

      await tx.insert(productsTable).values([
        {
          organizationId: organization.id,
          shopId: shop.id,
          categoryId: categoryByName.get("Breakfast"),
          name: "Masala omelette",
          priceCents: 18000,
        },
        {
          organizationId: organization.id,
          shopId: shop.id,
          categoryId: categoryByName.get("Beverages"),
          name: "Masala chai",
          priceCents: 7000,
          parcelType: "fixed",
          parcelValue: 500,
        },
        {
          organizationId: organization.id,
          shopId: shop.id,
          categoryId: categoryByName.get("Beverages"),
          name: "Cold coffee",
          priceCents: 14500,
        },
        {
          organizationId: organization.id,
          shopId: shop.id,
          categoryId: categoryByName.get("Bakery"),
          name: "Butter croissant",
          priceCents: 12000,
          parcelType: "fixed",
          parcelValue: 500,
        },
      ]);
    }

    return organization;
  });
}

async function ensureShopEmployee(userId: string, organizationId: number, shopId: number) {
  const [employee] = await db
    .select()
    .from(employeesTable)
    .where(
      and(
        eq(employeesTable.organizationId, organizationId),
        eq(employeesTable.shopId, shopId),
        eq(employeesTable.clerkUserId, userId),
      ),
    )
    .limit(1);
  if (employee) return employee;

  const [created] = await db
    .insert(employeesTable)
    .values({
      organizationId,
      shopId,
      clerkUserId: userId,
      name: "Owner",
      role: "owner",
    })
    .returning();
  return created;
}

function shopResponse(shop: typeof shopsTable.$inferSelect) {
  return {
    id: shop.id,
    name: shop.name,
    address: shop.address,
    phone: shop.phone,
    currency: shop.currency,
    taxRateBps: shop.taxRateBps,
    isActive: shop.isActive,
  };
}

function categoryResponse(category: typeof categoriesTable.$inferSelect) {
  return {
    id: category.id,
    shopId: category.shopId,
    name: category.name,
    color: category.color,
    sortOrder: category.sortOrder,
    isActive: category.isActive,
  };
}

function productResponse(product: typeof productsTable.$inferSelect) {
  return {
    id: product.id,
    shopId: product.shopId,
    categoryId: product.categoryId,
    name: product.name,
    description: product.description,
    priceCents: product.priceCents,
    sku: product.sku,
    imageUrl: product.imageUrl,
    isAvailable: product.isAvailable,
    parcelType: product.parcelType as "none" | "fixed" | "percent",
    parcelValue: product.parcelValue,
  };
}

async function employeeResponse(employee: typeof employeesTable.$inferSelect) {
  return {
    id: employee.id,
    shopId: employee.shopId,
    name: employee.name,
    role: employee.role as "owner" | "manager" | "cashier",
    isActive: employee.isActive,
  };
}

async function salesWithItems(
  organizationId: number,
  filters: {
    shopId?: number;
    employeeId?: number;
    from?: string | Date;
    to?: string | Date;
    limit?: number;
  } = {},
) {
  const conditions = [eq(salesTable.organizationId, organizationId)];
  if (filters.shopId) conditions.push(eq(salesTable.shopId, filters.shopId));
  if (filters.employeeId) conditions.push(eq(salesTable.employeeId, filters.employeeId));
  if (filters.from) conditions.push(gte(salesTable.createdAt, dateBound(filters.from)));
  if (filters.to) conditions.push(lte(salesTable.createdAt, dateBound(filters.to, true)));

  const rows = await db
    .select({ sale: salesTable, employeeName: employeesTable.name })
    .from(salesTable)
    .innerJoin(employeesTable, eq(salesTable.employeeId, employeesTable.id))
    .where(and(...conditions))
    .orderBy(desc(salesTable.createdAt))
    .limit(filters.limit ?? 1000);
  if (rows.length === 0) return [];

  const itemRows = await db
    .select()
    .from(saleItemsTable)
    .where(inArray(saleItemsTable.saleId, rows.map(({ sale }) => sale.id)))
    .orderBy(asc(saleItemsTable.id));
  const itemsBySale = new Map<number, typeof itemRows>();
  for (const item of itemRows) {
    const current = itemsBySale.get(item.saleId) ?? [];
    current.push(item);
    itemsBySale.set(item.saleId, current);
  }

  return rows.map(({ sale, employeeName }) => ({
    id: sale.id,
    shopId: sale.shopId,
    employeeId: sale.employeeId,
    employeeName,
    billNumber: sale.billNumber,
    orderType: sale.orderType as "dine-in" | "takeaway",
    paymentMethod: sale.paymentMethod as "cash" | "upi" | "card" | "other",
    subtotalCents: sale.subtotalCents,
    discountCents: sale.discountCents,
    taxCents: sale.taxCents,
    parcelCents: sale.parcelCents,
    totalCents: sale.totalCents,
    createdAt: sale.createdAt,
    items: (itemsBySale.get(sale.id) ?? []).map((item) => ({
      id: item.id,
      productName: item.productName,
      quantity: item.quantity,
      unitPriceCents: item.unitPriceCents,
      discountCents: item.discountCents,
      parcelCents: item.parcelCents,
      lineTotalCents: item.lineTotalCents,
    })),
  }));
}

async function expensesWithItems(
  organizationId: number,
  filters: { shopId?: number; from?: string | Date; to?: string | Date } = {},
) {
  const conditions = [eq(expensesTable.organizationId, organizationId)];
  if (filters.shopId) conditions.push(eq(expensesTable.shopId, filters.shopId));
  if (filters.from) conditions.push(gte(expensesTable.expenseDate, dateOnly(filters.from)));
  if (filters.to) conditions.push(lte(expensesTable.expenseDate, dateOnly(filters.to)));

  const rows = await db
    .select({ expense: expensesTable, employeeName: employeesTable.name })
    .from(expensesTable)
    .innerJoin(employeesTable, eq(expensesTable.employeeId, employeesTable.id))
    .where(and(...conditions))
    .orderBy(desc(expensesTable.expenseDate), desc(expensesTable.createdAt))
    .limit(1000);
  if (rows.length === 0) return [];

  const itemRows = await db
    .select()
    .from(expenseItemsTable)
    .where(inArray(expenseItemsTable.expenseId, rows.map(({ expense }) => expense.id)))
    .orderBy(asc(expenseItemsTable.id));
  const itemsByExpense = new Map<number, typeof itemRows>();
  for (const item of itemRows) {
    const current = itemsByExpense.get(item.expenseId) ?? [];
    current.push(item);
    itemsByExpense.set(item.expenseId, current);
  }

  return rows.map(({ expense, employeeName }) => ({
    id: expense.id,
    shopId: expense.shopId,
    employeeName,
    expenseDate: expense.expenseDate,
    supplier: expense.supplier,
    invoiceReference: expense.invoiceReference,
    paymentMethod: expense.paymentMethod as "cash" | "upi" | "card" | "other",
    note: expense.note,
    totalCents: expense.totalCents,
    createdAt: expense.createdAt,
    items: (itemsByExpense.get(expense.id) ?? []).map((item) => ({
      id: item.id,
      categoryName: item.categoryName,
      productName: item.productName,
      quantity: item.quantity,
      unit: item.unit,
      unitPriceCents: item.unitPriceCents,
      lineTotalCents: item.lineTotalCents,
    })),
  }));
}

router.get("/workspace", async (req, res): Promise<void> => {
  const organization = await ensureWorkspace(clerkId(req));
  const shops = await db
    .select()
    .from(shopsTable)
    .where(and(eq(shopsTable.organizationId, organization.id), eq(shopsTable.isActive, true)))
    .orderBy(asc(shopsTable.id));
  res.json(
    GetWorkspaceResponse.parse({
      businessName: organization.name,
      role: "owner",
      userName: "Owner",
      shops: shops.map(shopResponse),
    }),
  );
});

router.get("/shops", async (req, res): Promise<void> => {
  const organization = await ensureWorkspace(clerkId(req));
  const shops = await db
    .select()
    .from(shopsTable)
    .where(eq(shopsTable.organizationId, organization.id))
    .orderBy(asc(shopsTable.id));
  res.json(ListShopsResponse.parse(shops.map(shopResponse)));
});

router.post("/shops", async (req, res): Promise<void> => {
  const userId = clerkId(req);
  const organization = await ensureWorkspace(userId);
  const parsed = CreateShopBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const data = parsed.data;
  const shop = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(shopsTable)
      .values({
        organizationId: organization.id,
        name: data.name.trim(),
        address: data.address?.trim() || null,
        phone: data.phone?.trim() || null,
        currency: data.currency ?? "INR",
        taxRateBps: data.taxRateBps ?? 0,
      })
      .returning();
    await tx.insert(employeesTable).values({
      organizationId: organization.id,
      shopId: created.id,
      clerkUserId: userId,
      name: "Owner",
      role: "owner",
    });
    await tx.insert(auditLogsTable).values({
      organizationId: organization.id,
      shopId: created.id,
      actorClerkId: userId,
      action: "shop.created",
      entityType: "shop",
      entityId: created.id,
      details: { name: created.name },
    });
    return created;
  });
  res.status(201).json(CreateShopResponse.parse(shopResponse(shop)));
});

router.patch("/shops/:shopId", async (req, res): Promise<void> => {
  const organization = await ensureWorkspace(clerkId(req));
  const params = UpdateShopParams.safeParse(req.params);
  const body = UpdateShopBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: params.error?.message ?? body.error?.message });
    return;
  }
  const data = body.data;
  const [shop] = await db
    .update(shopsTable)
    .set({
      ...(data.name !== undefined ? { name: data.name.trim() } : {}),
      ...(data.address !== undefined ? { address: data.address.trim() || null } : {}),
      ...(data.phone !== undefined ? { phone: data.phone.trim() || null } : {}),
      ...(data.currency !== undefined ? { currency: data.currency } : {}),
      ...(data.taxRateBps !== undefined ? { taxRateBps: data.taxRateBps } : {}),
      ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
    })
    .where(and(eq(shopsTable.id, params.data.shopId), eq(shopsTable.organizationId, organization.id)))
    .returning();
  if (!shop) {
    res.status(404).json({ error: "Shop not found." });
    return;
  }
  res.json(UpdateShopResponse.parse(shopResponse(shop)));
});

router.get("/categories", async (req, res): Promise<void> => {
  const organization = await ensureWorkspace(clerkId(req));
  const parsed = ListCategoriesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const categories = await db
    .select()
    .from(categoriesTable)
    .where(
      and(
        eq(categoriesTable.organizationId, organization.id),
        eq(categoriesTable.shopId, parsed.data.shopId),
      ),
    )
    .orderBy(asc(categoriesTable.sortOrder), asc(categoriesTable.name));
  res.json(ListCategoriesResponse.parse(categories.map(categoryResponse)));
});

router.post("/categories", async (req, res): Promise<void> => {
  const organization = await ensureWorkspace(clerkId(req));
  const parsed = CreateCategoryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const data = parsed.data;
  const [shop] = await db
    .select({ id: shopsTable.id })
    .from(shopsTable)
    .where(and(eq(shopsTable.id, data.shopId), eq(shopsTable.organizationId, organization.id)))
    .limit(1);
  if (!shop) {
    res.status(404).json({ error: "Shop not found." });
    return;
  }
  const [category] = await db
    .insert(categoriesTable)
    .values({
      organizationId: organization.id,
      shopId: data.shopId,
      name: data.name.trim(),
      color: data.color ?? "#157a68",
      sortOrder: data.sortOrder ?? 0,
    })
    .returning();
  res.status(201).json(CreateCategoryResponse.parse(categoryResponse(category)));
});

router.patch("/categories/:categoryId", async (req, res): Promise<void> => {
  const organization = await ensureWorkspace(clerkId(req));
  const params = UpdateCategoryParams.safeParse(req.params);
  const body = UpdateCategoryBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: params.error?.message ?? body.error?.message });
    return;
  }
  const data = body.data;
  const [category] = await db
    .update(categoriesTable)
    .set({
      ...(data.name !== undefined ? { name: data.name.trim() } : {}),
      ...(data.color !== undefined ? { color: data.color } : {}),
      ...(data.sortOrder !== undefined ? { sortOrder: data.sortOrder } : {}),
      ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
    })
    .where(
      and(
        eq(categoriesTable.id, params.data.categoryId),
        eq(categoriesTable.organizationId, organization.id),
      ),
    )
    .returning();
  if (!category) {
    res.status(404).json({ error: "Category not found." });
    return;
  }
  res.json(UpdateCategoryResponse.parse(categoryResponse(category)));
});

router.get("/products", async (req, res): Promise<void> => {
  const organization = await ensureWorkspace(clerkId(req));
  const parsed = ListProductsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const conditions = [
    eq(productsTable.organizationId, organization.id),
    eq(productsTable.shopId, parsed.data.shopId),
  ];
  if (parsed.data.categoryId !== undefined) {
    conditions.push(eq(productsTable.categoryId, parsed.data.categoryId));
  }
  if (parsed.data.search?.trim()) {
    conditions.push(ilike(productsTable.name, `%${parsed.data.search.trim()}%`));
  }
  const products = await db
    .select()
    .from(productsTable)
    .where(and(...conditions))
    .orderBy(asc(productsTable.name));
  res.json(ListProductsResponse.parse(products.map(productResponse)));
});

router.post("/products", async (req, res): Promise<void> => {
  const organization = await ensureWorkspace(clerkId(req));
  const parsed = CreateProductBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const data = parsed.data;
  const [shop] = await db
    .select({ id: shopsTable.id })
    .from(shopsTable)
    .where(and(eq(shopsTable.id, data.shopId), eq(shopsTable.organizationId, organization.id)))
    .limit(1);
  if (!shop) {
    res.status(404).json({ error: "Shop not found." });
    return;
  }
  if (data.categoryId) {
    const [category] = await db
      .select({ id: categoriesTable.id })
      .from(categoriesTable)
      .where(
        and(
          eq(categoriesTable.id, data.categoryId),
          eq(categoriesTable.shopId, data.shopId),
          eq(categoriesTable.organizationId, organization.id),
        ),
      )
      .limit(1);
    if (!category) {
      res.status(400).json({ error: "Choose a category from this shop." });
      return;
    }
  }
  const [product] = await db
    .insert(productsTable)
    .values({
      organizationId: organization.id,
      shopId: data.shopId,
      categoryId: data.categoryId ?? null,
      name: data.name.trim(),
      description: data.description?.trim() || null,
      priceCents: data.priceCents,
      sku: data.sku?.trim() || null,
      imageUrl: data.imageUrl?.trim() || null,
      isAvailable: data.isAvailable ?? true,
      parcelType: data.parcelType ?? "none",
      parcelValue: data.parcelValue ?? 0,
    })
    .returning();
  res.status(201).json(CreateProductResponse.parse(productResponse(product)));
});

router.patch("/products/:productId", async (req, res): Promise<void> => {
  const organization = await ensureWorkspace(clerkId(req));
  const params = UpdateProductParams.safeParse(req.params);
  const body = UpdateProductBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: params.error?.message ?? body.error?.message });
    return;
  }
  const data = body.data;
  const [existing] = await db
    .select()
    .from(productsTable)
    .where(
      and(
        eq(productsTable.id, params.data.productId),
        eq(productsTable.organizationId, organization.id),
      ),
    )
    .limit(1);
  if (!existing) {
    res.status(404).json({ error: "Product not found." });
    return;
  }
  if (data.categoryId) {
    const [category] = await db
      .select({ id: categoriesTable.id })
      .from(categoriesTable)
      .where(
        and(
          eq(categoriesTable.id, data.categoryId),
          eq(categoriesTable.shopId, existing.shopId),
          eq(categoriesTable.organizationId, organization.id),
        ),
      )
      .limit(1);
    if (!category) {
      res.status(400).json({ error: "Choose a category from this shop." });
      return;
    }
  }
  const product = await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(productsTable)
      .set({
        ...(data.categoryId !== undefined ? { categoryId: data.categoryId } : {}),
        ...(data.name !== undefined ? { name: data.name.trim() } : {}),
        ...(data.description !== undefined ? { description: data.description.trim() || null } : {}),
        ...(data.priceCents !== undefined ? { priceCents: data.priceCents } : {}),
        ...(data.sku !== undefined ? { sku: data.sku.trim() || null } : {}),
        ...(data.imageUrl !== undefined ? { imageUrl: data.imageUrl.trim() || null } : {}),
        ...(data.isAvailable !== undefined ? { isAvailable: data.isAvailable } : {}),
        ...(data.parcelType !== undefined ? { parcelType: data.parcelType } : {}),
        ...(data.parcelValue !== undefined ? { parcelValue: data.parcelValue } : {}),
      })
      .where(eq(productsTable.id, existing.id))
      .returning();
    await tx.insert(auditLogsTable).values({
      organizationId: organization.id,
      shopId: existing.shopId,
      actorClerkId: clerkId(req),
      action: "product.updated",
      entityType: "product",
      entityId: existing.id,
      details: { name: updated.name, priceCents: updated.priceCents },
    });
    return updated;
  });
  res.json(UpdateProductResponse.parse(productResponse(product)));
});

router.get("/employees", async (req, res): Promise<void> => {
  const organization = await ensureWorkspace(clerkId(req));
  const parsed = ListEmployeesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const employees = await db
    .select()
    .from(employeesTable)
    .where(
      and(
        eq(employeesTable.organizationId, organization.id),
        eq(employeesTable.shopId, parsed.data.shopId),
      ),
    )
    .orderBy(asc(employeesTable.name));
  res.json(ListEmployeesResponse.parse(await Promise.all(employees.map(employeeResponse))));
});

router.post("/employees", async (req, res): Promise<void> => {
  const organization = await ensureWorkspace(clerkId(req));
  const parsed = CreateEmployeeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const data = parsed.data;
  const [shop] = await db
    .select({ id: shopsTable.id })
    .from(shopsTable)
    .where(and(eq(shopsTable.id, data.shopId), eq(shopsTable.organizationId, organization.id)))
    .limit(1);
  if (!shop) {
    res.status(404).json({ error: "Shop not found." });
    return;
  }
  const [employee] = await db
    .insert(employeesTable)
    .values({
      organizationId: organization.id,
      shopId: data.shopId,
      name: data.name.trim(),
      role: data.role,
    })
    .returning();
  res.status(201).json(CreateEmployeeResponse.parse(await employeeResponse(employee)));
});

router.get("/sales", async (req, res): Promise<void> => {
  const organization = await ensureWorkspace(clerkId(req));
  const parsed = ListSalesQueryParams.safeParse(parseDateQuery(req.query));
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  res.json(
    ListSalesResponse.parse(
      await salesWithItems(organization.id, {
        shopId: parsed.data.shopId,
        employeeId: parsed.data.employeeId,
        from: parsed.data.from,
        to: parsed.data.to,
      }),
    ),
  );
});

router.post("/sales", async (req, res): Promise<void> => {
  const userId = clerkId(req);
  const organization = await ensureWorkspace(userId);
  const parsed = CompleteSaleBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const data = parsed.data;
  const [shop] = await db
    .select()
    .from(shopsTable)
    .where(
      and(
        eq(shopsTable.id, data.shopId),
        eq(shopsTable.organizationId, organization.id),
        eq(shopsTable.isActive, true),
      ),
    )
    .limit(1);
  if (!shop) {
    res.status(404).json({ error: "Shop not found or inactive." });
    return;
  }
  const employee = await ensureShopEmployee(userId, organization.id, shop.id);
  const productIds = [...new Set(data.items.map((item) => item.productId))];
  if (productIds.length !== data.items.length) {
    res.status(400).json({ error: "Each product should appear once in a bill. Update its quantity instead." });
    return;
  }

  try {
    const saleId = await db.transaction(async (tx) => {
      const [existingSale] = await tx
        .select({ id: salesTable.id })
        .from(salesTable)
        .where(
          and(
            eq(salesTable.organizationId, organization.id),
            eq(salesTable.idempotencyKey, data.idempotencyKey),
          ),
        )
        .limit(1);
      if (existingSale) return existingSale.id;

      const items = await tx
        .select()
        .from(productsTable)
        .where(
          and(
            eq(productsTable.organizationId, organization.id),
            eq(productsTable.shopId, shop.id),
            eq(productsTable.isAvailable, true),
            inArray(productsTable.id, productIds),
          ),
        );
      if (items.length !== productIds.length) {
        throw new Error("One or more products are unavailable or belong to another shop.");
      }
      const productMap = new Map(items.map((item) => [item.id, item]));
      const computedLines = data.items.map((input) => {
        const product = productMap.get(input.productId);
        if (!product) throw new Error("One or more products are unavailable.");
        const grossCents = product.priceCents * input.quantity;
        if (input.discountCents > grossCents) {
          throw new Error(`Discount exceeds the price for ${product.name}.`);
        }
        const parcelCents =
          data.orderType !== "takeaway" || product.parcelType === "none"
            ? 0
            : product.parcelType === "fixed"
              ? product.parcelValue * input.quantity
              : Math.round((grossCents * product.parcelValue) / 10000);
        return {
          product,
          quantity: input.quantity,
          grossCents,
          discountCents: input.discountCents,
          parcelCents,
          lineTotalCents: grossCents - input.discountCents + parcelCents,
        };
      });
      const subtotalCents = computedLines.reduce((sum, line) => sum + line.grossCents, 0);
      const itemDiscountCents = computedLines.reduce((sum, line) => sum + line.discountCents, 0);
      const afterItemDiscount = subtotalCents - itemDiscountCents;
      if (data.discountCents > afterItemDiscount) {
        throw new Error("Order discount exceeds the remaining bill amount.");
      }
      const discountCents = itemDiscountCents + data.discountCents;
      const parcelCents = computedLines.reduce((sum, line) => sum + line.parcelCents, 0);
      const taxCents = Math.round(((afterItemDiscount - data.discountCents) * shop.taxRateBps) / 10000);
      const totalCents = subtotalCents - discountCents + taxCents + parcelCents;
      const [created] = await tx
        .insert(salesTable)
        .values({
          organizationId: organization.id,
          shopId: shop.id,
          employeeId: employee.id,
          idempotencyKey: data.idempotencyKey,
          billNumber: `pending-${data.idempotencyKey}`,
          orderType: data.orderType,
          paymentMethod: data.paymentMethod,
          subtotalCents,
          discountCents,
          taxCents,
          parcelCents,
          totalCents,
        })
        .onConflictDoNothing({ target: salesTable.idempotencyKey })
        .returning();
      if (!created) {
        const [replay] = await tx
          .select({ id: salesTable.id })
          .from(salesTable)
          .where(eq(salesTable.idempotencyKey, data.idempotencyKey))
          .limit(1);
        if (!replay) throw new Error("The payment could not be confirmed. Please retry.");
        return replay.id;
      }

      const billNumber = `BF-${shop.id}-${String(created.id).padStart(6, "0")}`;
      await tx.update(salesTable).set({ billNumber }).where(eq(salesTable.id, created.id));
      await tx.insert(saleItemsTable).values(
        computedLines.map((line) => ({
          saleId: created.id,
          productId: line.product.id,
          productName: line.product.name,
          quantity: line.quantity,
          unitPriceCents: line.product.priceCents,
          discountCents: line.discountCents,
          parcelCents: line.parcelCents,
          lineTotalCents: line.lineTotalCents,
        })),
      );
      await tx.insert(auditLogsTable).values({
        organizationId: organization.id,
        shopId: shop.id,
        actorClerkId: userId,
        action: "sale.completed",
        entityType: "sale",
        entityId: created.id,
        details: { billNumber, totalCents, paymentMethod: data.paymentMethod },
      });
      return created.id;
    });

    const [sale] = await salesWithItems(organization.id, { shopId: shop.id, limit: 1000 }).then((rows) =>
      rows.filter((row) => row.id === saleId),
    );
    if (!sale) {
      res.status(500).json({ error: "The transaction was saved, but its receipt could not be loaded." });
      return;
    }
    res.status(201).json(CompleteSaleResponse.parse(sale));
  } catch (error) {
    req.log.warn({ err: error }, "BillFlow sale was not completed");
    res.status(400).json({
      error: error instanceof Error ? error.message : "The payment was not completed.",
    });
  }
});

router.get("/expenses", async (req, res): Promise<void> => {
  const organization = await ensureWorkspace(clerkId(req));
  const parsed = ListExpensesQueryParams.safeParse(parseDateQuery(req.query));
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  res.json(
    ListExpensesResponse.parse(
      await expensesWithItems(organization.id, {
        shopId: parsed.data.shopId,
        from: parsed.data.from,
        to: parsed.data.to,
      }),
    ),
  );
});

router.post("/expenses", async (req, res): Promise<void> => {
  const userId = clerkId(req);
  const organization = await ensureWorkspace(userId);
  const parsed = CreateExpenseBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const data = parsed.data;
  const [shop] = await db
    .select()
    .from(shopsTable)
    .where(
      and(
        eq(shopsTable.id, data.shopId),
        eq(shopsTable.organizationId, organization.id),
        eq(shopsTable.isActive, true),
      ),
    )
    .limit(1);
  if (!shop) {
    res.status(404).json({ error: "Shop not found or inactive." });
    return;
  }
  const employee = await ensureShopEmployee(userId, organization.id, shop.id);
  const items = data.items.map((item) => ({
    categoryName: item.categoryName.trim(),
    productName: item.productName.trim(),
    quantity: item.quantity,
    unit: item.unit.trim(),
    unitPriceCents: item.unitPriceCents,
    lineTotalCents: Math.round(item.quantity * item.unitPriceCents),
  }));
  const totalCents = items.reduce((sum, item) => sum + item.lineTotalCents, 0);
  const expenseDateValue = dateOnly(data.expenseDate);
  const expenseId = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(expensesTable)
      .values({
        organizationId: organization.id,
        shopId: shop.id,
        employeeId: employee.id,
        expenseDate: expenseDateValue,
        supplier: data.supplier?.trim() || null,
        invoiceReference: data.invoiceReference?.trim() || null,
        paymentMethod: data.paymentMethod,
        note: data.note?.trim() || null,
        totalCents,
      })
      .returning();
    await tx.insert(expenseItemsTable).values(items.map((item) => ({ expenseId: created.id, ...item })));
    await tx.insert(auditLogsTable).values({
      organizationId: organization.id,
      shopId: shop.id,
      actorClerkId: userId,
      action: "expense.created",
      entityType: "expense",
      entityId: created.id,
      details: { totalCents, itemCount: items.length },
    });
    return created.id;
  });
  const [expense] = await expensesWithItems(organization.id, { shopId: shop.id }).then((rows) =>
    rows.filter((row) => row.id === expenseId),
  );
  if (!expense) {
    res.status(500).json({ error: "The expense was saved, but it could not be loaded." });
    return;
  }
  res.status(201).json(CreateExpenseResponse.parse(expense));
});

router.get("/dashboard", async (req, res): Promise<void> => {
  const organization = await ensureWorkspace(clerkId(req));
  const parsed = GetDashboardQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const shopId = parsed.data.shopId;
  if (shopId) {
    const [shop] = await db
      .select({ id: shopsTable.id })
      .from(shopsTable)
      .where(and(eq(shopsTable.id, shopId), eq(shopsTable.organizationId, organization.id)))
      .limit(1);
    if (!shop) {
      res.status(404).json({ error: "Shop not found." });
      return;
    }
  }

  const today = todayInIndia();
  const [year, month, day] = today.split("-").map(Number);
  const todayStart = new Date(`${today}T00:00:00.000+05:30`);
  const tomorrowString = new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
  const tomorrowStart = new Date(`${tomorrowString}T00:00:00.000+05:30`);
  const sevenDaysAgo = new Date(Date.UTC(year, month - 1, day - 6)).toISOString().slice(0, 10);
  const rangeConditions = [
    eq(salesTable.organizationId, organization.id),
    gte(salesTable.createdAt, new Date(`${sevenDaysAgo}T00:00:00.000+05:30`)),
    lte(salesTable.createdAt, new Date(`${tomorrowString}T00:00:00.000+05:30`)),
  ];
  const expenseConditions = [
    eq(expensesTable.organizationId, organization.id),
    gte(expensesTable.expenseDate, today),
    lte(expensesTable.expenseDate, today),
  ];
  if (shopId) {
    rangeConditions.push(eq(salesTable.shopId, shopId));
    expenseConditions.push(eq(expensesTable.shopId, shopId));
  }
  const saleRows = await db
    .select()
    .from(salesTable)
    .where(and(...rangeConditions))
    .orderBy(desc(salesTable.createdAt));
  const expenseRows = await db
    .select({ totalCents: expensesTable.totalCents })
    .from(expensesTable)
    .where(and(...expenseConditions));
  const todaySales = saleRows.filter(
    (sale) => sale.createdAt >= todayStart && sale.createdAt < tomorrowStart,
  );
  const salesCents = todaySales.reduce((sum, sale) => sum + sale.totalCents, 0);
  const expensesCents = expenseRows.reduce((sum, expense) => sum + expense.totalCents, 0);
  const paymentMap = new Map<string, number>();
  for (const sale of todaySales) {
    paymentMap.set(sale.paymentMethod, (paymentMap.get(sale.paymentMethod) ?? 0) + sale.totalCents);
  }
  const salesByDay = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(Date.UTC(year, month - 1, day - 6 + index)).toISOString().slice(0, 10);
    const start = new Date(`${date}T00:00:00.000+05:30`);
    const end = new Date(`${new Date(Date.UTC(year, month - 1, day - 5 + index)).toISOString().slice(0, 10)}T00:00:00.000+05:30`);
    return {
      date,
      totalCents: saleRows
        .filter((sale) => sale.createdAt >= start && sale.createdAt < end)
        .reduce((sum, sale) => sum + sale.totalCents, 0),
    };
  });
  const recentSales = await salesWithItems(organization.id, { shopId, limit: 5 });
  res.json(
    GetDashboardResponse.parse({
      salesCents,
      billCount: todaySales.length,
      expensesCents,
      operatingBalanceCents: salesCents - expensesCents,
      averageBillCents: todaySales.length ? Math.round(salesCents / todaySales.length) : 0,
      salesByDay,
      payments: [...paymentMap.entries()].map(([method, totalCents]) => ({ method, totalCents })),
      recentSales,
    }),
  );
});

router.get("/reports/sales", async (req, res): Promise<void> => {
  const organization = await ensureWorkspace(clerkId(req));
  const parsed = GetSalesReportQueryParams.safeParse(parseDateQuery(req.query));
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const sales = await salesWithItems(organization.id, {
    shopId: parsed.data.shopId,
    from: parsed.data.from,
    to: parsed.data.to,
  });
  const byEmployee = new Map<string, { employeeName: string; billCount: number; totalCents: number }>();
  const byPayment = new Map<string, number>();
  for (const sale of sales) {
    const employee = byEmployee.get(sale.employeeName) ?? {
      employeeName: sale.employeeName,
      billCount: 0,
      totalCents: 0,
    };
    employee.billCount += 1;
    employee.totalCents += sale.totalCents;
    byEmployee.set(sale.employeeName, employee);
    byPayment.set(sale.paymentMethod, (byPayment.get(sale.paymentMethod) ?? 0) + sale.totalCents);
  }
  res.json(
    GetSalesReportResponse.parse({
      totalCents: sales.reduce((sum, sale) => sum + sale.totalCents, 0),
      billCount: sales.length,
      parcelCents: sales.reduce((sum, sale) => sum + sale.parcelCents, 0),
      discountCents: sales.reduce((sum, sale) => sum + sale.discountCents, 0),
      byEmployee: [...byEmployee.values()],
      byPayment: [...byPayment.entries()].map(([method, totalCents]) => ({ method, totalCents })),
      sales,
    }),
  );
});

router.get("/reports/expenses", async (req, res): Promise<void> => {
  const organization = await ensureWorkspace(clerkId(req));
  const parsed = GetExpensesReportQueryParams.safeParse(parseDateQuery(req.query));
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const expenses = await expensesWithItems(organization.id, {
    shopId: parsed.data.shopId,
    from: parsed.data.from,
    to: parsed.data.to,
  });
  const categoryTotals = new Map<string, number>();
  for (const expense of expenses) {
    for (const item of expense.items) {
      categoryTotals.set(
        item.categoryName,
        (categoryTotals.get(item.categoryName) ?? 0) + item.lineTotalCents,
      );
    }
  }
  res.json(
    GetExpensesReportResponse.parse({
      totalCents: expenses.reduce((sum, expense) => sum + expense.totalCents, 0),
      byCategory: [...categoryTotals.entries()].map(([categoryName, totalCents]) => ({
        categoryName,
        totalCents,
      })),
      expenses,
    }),
  );
});

export default router;
