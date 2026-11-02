export type CustomFetchOptions = RequestInit & {
  responseType?: "json" | "text" | "blob" | "auto";
};

export type ErrorType<T = unknown> = ApiError<T>;

export type BodyType<T> = T;

export type AuthTokenGetter = () => Promise<string | null> | string | null;

const NO_BODY_STATUS = new Set([204, 205, 304]);
const DEFAULT_JSON_ACCEPT = "application/json, application/problem+json";

// ---------------------------------------------------------------------------
// Module-level configuration
// ---------------------------------------------------------------------------

let _baseUrl: string | null = null;
let _authTokenGetter: AuthTokenGetter | null = null;

/**
 * Set a base URL that is prepended to every relative request URL
 * (i.e. paths that start with `/`).
 *
 * Useful for Expo bundles that need to call a remote API server.
 * Pass `null` to clear the base URL.
 */
export function setBaseUrl(url: string | null): void {
  _baseUrl = url ? url.replace(/\/+$/, "") : null;
}

/**
 * Register a getter that supplies a bearer auth token.  Before every fetch
 * the getter is invoked; when it returns a non-null string, an
 * `Authorization: Bearer <token>` header is attached to the request.
 *
 * Useful for Expo bundles making token-gated API calls.
 * Pass `null` to clear the getter.
 *
 * NOTE: This function should never be used in web applications where session
 * token cookies are automatically associated with API calls by the browser.
 */
export function setAuthTokenGetter(getter: AuthTokenGetter | null): void {
  _authTokenGetter = getter;
}

function isRequest(input: RequestInfo | URL): input is Request {
  return typeof Request !== "undefined" && input instanceof Request;
}

function resolveMethod(input: RequestInfo | URL, explicitMethod?: string): string {
  if (explicitMethod) return explicitMethod.toUpperCase();
  if (isRequest(input)) return input.method.toUpperCase();
  return "GET";
}

// Use loose check for URL — some runtimes (e.g. React Native) polyfill URL
// differently, so `instanceof URL` can fail.
function isUrl(input: RequestInfo | URL): input is URL {
  return typeof URL !== "undefined" && input instanceof URL;
}

function applyBaseUrl(input: RequestInfo | URL): RequestInfo | URL {
  if (!_baseUrl) return input;
  const url = resolveUrl(input);
  // Only prepend to relative paths (starting with /)
  if (!url.startsWith("/")) return input;

  const absolute = `${_baseUrl}${url}`;
  if (typeof input === "string") return absolute;
  if (isUrl(input)) return new URL(absolute);
  return new Request(absolute, input as Request);
}

function resolveUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (isUrl(input)) return input.toString();
  return input.url;
}

function mergeHeaders(...sources: Array<HeadersInit | undefined>): Headers {
  const headers = new Headers();

  for (const source of sources) {
    if (!source) continue;
    new Headers(source).forEach((value, key) => {
      headers.set(key, value);
    });
  }

  return headers;
}

function getMediaType(headers: Headers): string | null {
  const value = headers.get("content-type");
  return value ? value.split(";", 1)[0].trim().toLowerCase() : null;
}

function isJsonMediaType(mediaType: string | null): boolean {
  return mediaType === "application/json" || Boolean(mediaType?.endsWith("+json"));
}

function isTextMediaType(mediaType: string | null): boolean {
  return Boolean(
    mediaType &&
      (mediaType.startsWith("text/") ||
        mediaType === "application/xml" ||
        mediaType === "text/xml" ||
        mediaType.endsWith("+xml") ||
        mediaType === "application/x-www-form-urlencoded"),
  );
}

// Use strict equality: in browsers, `response.body` is `null` when the
// response genuinely has no content.  In React Native, `response.body` is
// always `undefined` because the ReadableStream API is not implemented —
// even when the response carries a full payload readable via `.text()` or
// `.json()`.  Loose equality (`== null`) matches both `null` and `undefined`,
// which causes every React Native response to be treated as empty.
function hasNoBody(response: Response, method: string): boolean {
  if (method === "HEAD") return true;
  if (NO_BODY_STATUS.has(response.status)) return true;
  if (response.headers.get("content-length") === "0") return true;
  if (response.body === null) return true;
  return false;
}

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function looksLikeJson(text: string): boolean {
  const trimmed = text.trimStart();
  return trimmed.startsWith("{") || trimmed.startsWith("[");
}

function getStringField(value: unknown, key: string): string | undefined {
  if (!value || typeof value !== "object") return undefined;

  const candidate = (value as Record<string, unknown>)[key];
  if (typeof candidate !== "string") return undefined;

  const trimmed = candidate.trim();
  return trimmed === "" ? undefined : trimmed;
}

function truncate(text: string, maxLength = 300): string {
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

function buildErrorMessage(response: Response, data: unknown): string {
  const prefix = `HTTP ${response.status} ${response.statusText}`;

  if (typeof data === "string") {
    const text = data.trim();
    return text ? `${prefix}: ${truncate(text)}` : prefix;
  }

  const title = getStringField(data, "title");
  const detail = getStringField(data, "detail");
  const message =
    getStringField(data, "message") ??
    getStringField(data, "error_description") ??
    getStringField(data, "error");

  if (title && detail) return `${prefix}: ${title} — ${detail}`;
  if (detail) return `${prefix}: ${detail}`;
  if (message) return `${prefix}: ${message}`;
  if (title) return `${prefix}: ${title}`;

  return prefix;
}

export class ApiError<T = unknown> extends Error {
  readonly name = "ApiError";
  readonly status: number;
  readonly statusText: string;
  readonly data: T | null;
  readonly headers: Headers;
  readonly response: Response;
  readonly method: string;
  readonly url: string;

  constructor(
    response: Response,
    data: T | null,
    requestInfo: { method: string; url: string },
  ) {
    super(buildErrorMessage(response, data));
    Object.setPrototypeOf(this, new.target.prototype);

    this.status = response.status;
    this.statusText = response.statusText;
    this.data = data;
    this.headers = response.headers;
    this.response = response;
    this.method = requestInfo.method;
    this.url = response.url || requestInfo.url;
  }
}

export class ResponseParseError extends Error {
  readonly name = "ResponseParseError";
  readonly status: number;
  readonly statusText: string;
  readonly headers: Headers;
  readonly response: Response;
  readonly method: string;
  readonly url: string;
  readonly rawBody: string;
  readonly cause: unknown;

  constructor(
    response: Response,
    rawBody: string,
    cause: unknown,
    requestInfo: { method: string; url: string },
  ) {
    super(
      `Failed to parse response from ${requestInfo.method} ${response.url || requestInfo.url} ` +
        `(${response.status} ${response.statusText}) as JSON`,
    );
    Object.setPrototypeOf(this, new.target.prototype);

    this.status = response.status;
    this.statusText = response.statusText;
    this.headers = response.headers;
    this.response = response;
    this.method = requestInfo.method;
    this.url = response.url || requestInfo.url;
    this.rawBody = rawBody;
    this.cause = cause;
  }
}

async function parseJsonBody(
  response: Response,
  requestInfo: { method: string; url: string },
): Promise<unknown> {
  const raw = await response.text();
  const normalized = stripBom(raw);

  if (normalized.trim() === "") {
    return null;
  }

  try {
    return JSON.parse(normalized);
  } catch (cause) {
    throw new ResponseParseError(response, raw, cause, requestInfo);
  }
}

async function parseErrorBody(response: Response, method: string): Promise<unknown> {
  if (hasNoBody(response, method)) {
    return null;
  }

  const mediaType = getMediaType(response.headers);

  // Fall back to text when blob() is unavailable (e.g. some React Native builds).
  if (mediaType && !isJsonMediaType(mediaType) && !isTextMediaType(mediaType)) {
    return typeof response.blob === "function" ? response.blob() : response.text();
  }

  const raw = await response.text();
  const normalized = stripBom(raw);
  const trimmed = normalized.trim();

  if (trimmed === "") {
    return null;
  }

  if (isJsonMediaType(mediaType) || looksLikeJson(normalized)) {
    try {
      return JSON.parse(normalized);
    } catch {
      return raw;
    }
  }

  return raw;
}

function inferResponseType(response: Response): "json" | "text" | "blob" {
  const mediaType = getMediaType(response.headers);

  if (isJsonMediaType(mediaType)) return "json";
  if (isTextMediaType(mediaType) || mediaType == null) return "text";
  return "blob";
}

async function parseSuccessBody(
  response: Response,
  responseType: "json" | "text" | "blob" | "auto",
  requestInfo: { method: string; url: string },
): Promise<unknown> {
  if (hasNoBody(response, requestInfo.method)) {
    return null;
  }

  const effectiveType =
    responseType === "auto" ? inferResponseType(response) : responseType;

  switch (effectiveType) {
    case "json":
      return parseJsonBody(response, requestInfo);

    case "text": {
      const text = await response.text();
      return text === "" ? null : text;
    }

    case "blob":
      if (typeof response.blob !== "function") {
        throw new TypeError(
          "Blob responses are not supported in this runtime. " +
            "Use responseType \"json\" or \"text\" instead.",
        );
      }
      return response.blob();
  }
}

export async function customFetch<T = unknown>(
  input: RequestInfo | URL,
  options: CustomFetchOptions = {},
): Promise<T> {
  input = applyBaseUrl(input);
  const { responseType = "auto", headers: headersInit, ...init } = options;

  const method = resolveMethod(input, init.method);

  if (init.body != null && (method === "GET" || method === "HEAD")) {
    throw new TypeError(`customFetch: ${method} requests cannot have a body.`);
  }

  const headers = mergeHeaders(isRequest(input) ? input.headers : undefined, headersInit);

  if (
    typeof init.body === "string" &&
    !headers.has("content-type") &&
    looksLikeJson(init.body)
  ) {
    headers.set("content-type", "application/json");
  }

  if (responseType === "json" && !headers.has("accept")) {
    headers.set("accept", DEFAULT_JSON_ACCEPT);
  }

  // Attach bearer token when an auth getter is configured and no
  // Authorization header has been explicitly provided.
  if (_authTokenGetter && !headers.has("authorization")) {
    const token = await _authTokenGetter();
    if (token) {
      headers.set("authorization", `Bearer ${token}`);
    }
  }

  const urlStr = resolveUrl(input);
  const requestInfo = { method, url: urlStr };

  const isGet = method === "GET" || method === "HEAD";
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, isGet ? 12000 : 15000);

  try {
    const response = await fetch(input, {
      ...init,
      method,
      headers,
      signal: init.signal || controller.signal,
    });
    clearTimeout(timeoutId);

    // Detect if server/Vite returned HTML (SPA fallback) instead of JSON for an API endpoint
    const contentType = response.headers.get("content-type") || "";
    if (urlStr.includes("/api/") && contentType.includes("text/html")) {
      return handleOfflineApiFallback<T>(urlStr, method, init.body);
    }

    if (!response.ok) {
      if ((response.status >= 500 || response.status === 404 || response.status === 401 || response.status === 403) && urlStr.includes("/api/")) {
        return handleOfflineApiFallback<T>(urlStr, method, init.body);
      }
      const errorData = await parseErrorBody(response, method);
      throw new ApiError(response, errorData, requestInfo);
    }

    const result = (await parseSuccessBody(response, responseType, requestInfo)) as T;
    syncToLocalBackup(urlStr, method, result);
    return result;
  } catch (err) {
    clearTimeout(timeoutId);
    if (urlStr.includes("/api/")) {
      return handleOfflineApiFallback<T>(urlStr, method, init.body);
    }
    throw err;
  }
}

function syncToLocalBackup(urlStr: string, method: string, data: any): void {
  try {
    if (!data || typeof window === "undefined" || !window.localStorage) return;
    const path = urlStr.includes("/api/") ? "/api/" + urlStr.split("/api/")[1].split("?")[0] : "";
    if (!path) return;

    if (path === "/api/shops" && method === "GET" && Array.isArray(data) && data.length > 0) {
      setLocalItem("billflow-offline-shops", data);
    } else if (path === "/api/categories") {
      if (method === "GET" && Array.isArray(data) && data.length > 0) {
        setLocalItem("billflow-offline-categories", data);
      } else if (method === "POST" && data?.id) {
        const cats = getLocalItem<any[]>("billflow-offline-categories", DEFAULT_CATEGORIES);
        const filtered = cats.filter(c => c.id !== data.id);
        setLocalItem("billflow-offline-categories", [...filtered, data]);
      }
    } else if (path === "/api/products") {
      if (method === "GET" && Array.isArray(data) && data.length > 0) {
        setLocalItem("billflow-offline-products", data);
      } else if (method === "POST" && data?.id) {
        const prods = getLocalItem<any[]>("billflow-offline-products", DEFAULT_PRODUCTS);
        const filtered = prods.filter(p => p.id !== data.id);
        setLocalItem("billflow-offline-products", [data, ...filtered]);
      }
    } else if (path.startsWith("/api/products/") && (method === "PATCH" || method === "PUT") && data?.id) {
      const prods = getLocalItem<any[]>("billflow-offline-products", DEFAULT_PRODUCTS);
      const updated = prods.map(p => (p.id === data.id ? { ...p, ...data } : p));
      setLocalItem("billflow-offline-products", updated);
    } else if (path === "/api/employees" && method === "GET" && Array.isArray(data) && data.length > 0) {
      setLocalItem("billflow-offline-employees", data);
    } else if (path === "/api/sales") {
      if (method === "GET" && Array.isArray(data)) {
        if (data.length > 0) {
          const localSales = getLocalItem<any[]>("billflow-offline-sales", []);
          const merged = [...data];
          for (const s of localSales) {
            if (!merged.some(m => (m.id && m.id === s.id) || (m.billNumber && m.billNumber === s.billNumber))) {
              merged.push(s);
            }
          }
          setLocalItem("billflow-offline-sales", merged);
        }
      } else if (method === "POST" && (data?.id || data?.billNumber)) {
        const sales = getLocalItem<any[]>("billflow-offline-sales", []);
        const filtered = sales.filter(s => (s.id !== data.id) && (!data.billNumber || s.billNumber !== data.billNumber));
        setLocalItem("billflow-offline-sales", [data, ...filtered]);
      }
    } else if (path === "/api/expenses") {
      if (method === "GET" && Array.isArray(data)) {
        if (data.length > 0) {
          const localExpenses = getLocalItem<any[]>("billflow-offline-expenses", []);
          const merged = [...data];
          for (const e of localExpenses) {
            if (!merged.some(m => m.id && m.id === e.id)) {
              merged.push(e);
            }
          }
          setLocalItem("billflow-offline-expenses", merged);
        }
      } else if (method === "POST" && data?.id) {
        const expenses = getLocalItem<any[]>("billflow-offline-expenses", []);
        const filtered = expenses.filter(e => e.id !== data.id);
        setLocalItem("billflow-offline-expenses", [data, ...filtered]);
      }
    }
  } catch {}
}

// ─────────────────────────────────────────────────────────────────────────────
// Offline-first Local Storage Fallback Engine
// ─────────────────────────────────────────────────────────────────────────────
function getLocalItem<T>(key: string, defaultValue: T): T {
  try {
    if (typeof window === "undefined" || !window.localStorage) return defaultValue;
    const raw = window.localStorage.getItem(key);
    if (!raw) return defaultValue;
    return JSON.parse(raw);
  } catch {
    return defaultValue;
  }
}

function setLocalItem<T>(key: string, value: T): void {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem(key, JSON.stringify(value));
    }
  } catch {}
}

const DEFAULT_SHOPS = [
  {
    id: 1,
    name: "Main Store",
    address: "",
    phone: "",
    currency: "AED",
    taxRateBps: 500,
    taxType: "inclusive",
    isActive: true,
    createdAt: new Date().toISOString(),
  },
];

const DEFAULT_CATEGORIES: any[] = [];
const DEFAULT_PRODUCTS: any[] = [];
const DEFAULT_EMPLOYEES: any[] = [];

function handleOfflineApiFallback<T>(url: string, method: string, body?: any): T {
  const urlObj = new URL(url, typeof window !== "undefined" ? window.location.origin : "http://localhost");
  const path = urlObj.pathname;
  const parsedBody = typeof body === "string" ? (() => { try { return JSON.parse(body); } catch { return {}; } })() : body || {};

  // /api/healthz or /api/health
  if (path === "/api/healthz" || path === "/api/health") {
    return { status: "ok" } as T;
  }

  // /api/workspace
  if (path === "/api/workspace") {
    const shops = getLocalItem("billflow-offline-shops", DEFAULT_SHOPS);
    const localUser = getLocalItem<any>("billflow-local-user", null);
    return {
      businessName: "BillFlow Retail POS",
      role: localUser?.role || "owner",
      userName: localUser?.name || "Store Owner",
      shops,
    } as T;
  }

  // /api/shops
  if (path === "/api/shops") {
    const shops = getLocalItem("billflow-offline-shops", DEFAULT_SHOPS);
    if (method === "GET") {
      return shops as T;
    }
    if (method === "POST") {
      const newShop = {
        id: (shops[shops.length - 1]?.id || 0) + 1,
        name: parsedBody.name || "New Shop",
        address: parsedBody.address || "",
        phone: parsedBody.phone || "",
        currency: parsedBody.currency || "AED",
        taxRateBps: Number(parsedBody.taxRateBps) || 0,
        taxType: parsedBody.taxType || "inclusive",
        isActive: true,
        createdAt: new Date().toISOString(),
      };
      const updated = [...shops, newShop];
      setLocalItem("billflow-offline-shops", updated);
      return newShop as T;
    }
  }

  // /api/shops/:id
  const shopMatch = path.match(/^\/api\/shops\/(\d+)$/);
  if (shopMatch) {
    const shopId = Number(shopMatch[1]);
    const shops = getLocalItem("billflow-offline-shops", DEFAULT_SHOPS);
    if (method === "PATCH") {
      const updated = shops.map((s: any) => s.id === shopId ? { ...s, ...parsedBody } : s);
      setLocalItem("billflow-offline-shops", updated);
      const found = updated.find((s: any) => s.id === shopId);
      return found as T;
    }
    return (shops.find((s: any) => s.id === shopId) || shops[0]) as T;
  }

  // /api/categories
  if (path === "/api/categories") {
    const categories = getLocalItem("billflow-offline-categories", DEFAULT_CATEGORIES);
    if (method === "GET") return categories as T;
    if (method === "POST") {
      const newCat = {
        id: (categories[categories.length - 1]?.id || 0) + 1,
        shopId: Number(parsedBody.shopId) || 1,
        name: parsedBody.name || "New Category",
        color: parsedBody.color || "#315f52",
        sortOrder: Number(parsedBody.sortOrder) || categories.length,
        isActive: true,
      };
      const updated = [...categories, newCat];
      setLocalItem("billflow-offline-categories", updated);
      return newCat as T;
    }
  }

  // /api/categories/:id
  const catMatch = path.match(/^\/api\/categories\/(\d+)$/);
  if (catMatch) {
    const catId = Number(catMatch[1]);
    const categories = getLocalItem("billflow-offline-categories", DEFAULT_CATEGORIES);
    if (method === "PATCH") {
      const updated = categories.map((c: any) => c.id === catId ? { ...c, ...parsedBody } : c);
      setLocalItem("billflow-offline-categories", updated);
      return updated.find((c: any) => c.id === catId) as T;
    }
    return (categories.find((c: any) => c.id === catId) || categories[0]) as T;
  }

  // /api/products
  if (path === "/api/products") {
    const products = getLocalItem("billflow-offline-products", DEFAULT_PRODUCTS);
    if (method === "GET") {
      const search = urlObj.searchParams.get("search")?.toLowerCase();
      const catId = urlObj.searchParams.get("categoryId");
      let filtered = products;
      if (catId) filtered = filtered.filter((p: any) => p.categoryId === Number(catId));
      if (search) filtered = filtered.filter((p: any) => p.name.toLowerCase().includes(search) || (p.sku && p.sku.toLowerCase().includes(search)));
      return filtered as T;
    }
    if (method === "POST") {
      const newProd = {
        id: (products[products.length - 1]?.id || 0) + 1,
        shopId: Number(parsedBody.shopId) || 1,
        categoryId: parsedBody.categoryId ? Number(parsedBody.categoryId) : null,
        name: parsedBody.name || "New Product",
        description: parsedBody.description || "",
        priceCents: Number(parsedBody.priceCents) || 0,
        sku: parsedBody.sku || "",
        imageUrl: parsedBody.imageUrl || "",
        isAvailable: parsedBody.isAvailable !== false,
        parcelType: parsedBody.parcelType || "none",
        parcelValue: Number(parsedBody.parcelValue) || 0,
      };
      const updated = [...products, newProd];
      setLocalItem("billflow-offline-products", updated);
      return newProd as T;
    }
  }

  // /api/products/:id
  const prodMatch = path.match(/^\/api\/products\/(\d+)$/);
  if (prodMatch) {
    const prodId = Number(prodMatch[1]);
    const products = getLocalItem("billflow-offline-products", DEFAULT_PRODUCTS);
    if (method === "PATCH") {
      const updated = products.map((p: any) => p.id === prodId ? { ...p, ...parsedBody } : p);
      setLocalItem("billflow-offline-products", updated);
      return updated.find((p: any) => p.id === prodId) as T;
    }
    return (products.find((p: any) => p.id === prodId) || products[0]) as T;
  }

  // /api/employees
  if (path === "/api/employees") {
    const employees = getLocalItem("billflow-offline-employees", DEFAULT_EMPLOYEES);
    if (method === "GET") return employees as T;
    if (method === "POST") {
      const newEmp = {
        id: (employees[employees.length - 1]?.id || 0) + 1,
        shopId: Number(parsedBody.shopId) || 1,
        name: parsedBody.name || "Staff Member",
        role: parsedBody.role || "cashier",
        isActive: true,
      };
      const updated = [...employees, newEmp];
      setLocalItem("billflow-offline-employees", updated);
      return newEmp as T;
    }
  }

  // /api/sales
  if (path === "/api/sales") {
    const sales = getLocalItem<any[]>("billflow-offline-sales", []);
    if (method === "GET") {
      const from = urlObj.searchParams.get("from");
      const to = urlObj.searchParams.get("to");
      let filtered = sales;
      if (from) filtered = filtered.filter(s => s.createdAt.slice(0, 10) >= from);
      if (to) filtered = filtered.filter(s => s.createdAt.slice(0, 10) <= to);
      return filtered as T;
    }
    if (method === "POST") {
      const products = getLocalItem("billflow-offline-products", DEFAULT_PRODUCTS);
      const isTakeaway = parsedBody.orderType === "takeaway";
      let totalParcelCents = 0;

      const items = (parsedBody.items || []).map((it: any) => {
        const prod = products.find((p: any) => p.id === it.productId);
        const unitPrice = prod?.priceCents || 1000;
        const qty = it.quantity || 1;
        const gross = unitPrice * qty;
        const discount = it.discountCents || 0;
        const parcelPerUnit = (isTakeaway && prod?.parcelType === "fixed") ? (prod.parcelValue || 0) : 0;
        const lineParcel = parcelPerUnit * qty;
        totalParcelCents += lineParcel;

        return {
          id: Math.floor(Math.random() * 100000),
          productId: it.productId,
          productName: prod?.name || "Item",
          quantity: qty,
          unitPriceCents: unitPrice,
          discountCents: discount,
          parcelCents: lineParcel,
          lineTotalCents: gross - discount + lineParcel,
        };
      });

      const subtotalCents = items.reduce((acc: number, x: any) => acc + (x.unitPriceCents * x.quantity), 0);
      const discountCents = Number(parsedBody.discountCents) || 0;
      const afterDiscount = Math.max(0, subtotalCents - discountCents);

      const shops = getLocalItem("billflow-offline-shops", DEFAULT_SHOPS);
      const shopId = Number(parsedBody.shopId) || 1;
      const currentShop = shops.find((s: any) => s.id === shopId) || shops[0];
      const taxRateBps = Number(currentShop?.taxRateBps) || 500;
      const isTaxExclusive = currentShop?.taxType === "exclusive";

      const taxCents = isTaxExclusive
        ? Math.round((afterDiscount * taxRateBps) / 10000)
        : Math.round((afterDiscount * taxRateBps) / (10000 + taxRateBps));
      const totalCents = isTaxExclusive
        ? afterDiscount + taxCents + totalParcelCents
        : afterDiscount + totalParcelCents;

      const localUser = getLocalItem<any>("billflow-local-user", null);
      const employeeName = parsedBody.employeeName || localUser?.name || "Store Owner";

      const nextId = sales.reduce((max, s) => Math.max(max, Number(s.id) || 0), 0) + 1;
      const nextBillNum = sales.reduce((max, s) => {
        const num = parseInt(String(s.billNumber).replace(/\D/g, ""), 10);
        return isNaN(num) ? max : Math.max(max, num);
      }, 1000) + 1;

      const newSale = {
        id: nextId,
        billNumber: String(nextBillNum),
        shopId: Number(parsedBody.shopId) || 1,
        employeeId: localUser?.id || 1,
        employeeName,
        orderType: parsedBody.orderType || "dine-in",
        paymentMethod: parsedBody.paymentMethod || "cash",
        subtotalCents,
        discountCents,
        taxCents,
        parcelCents: totalParcelCents,
        totalCents,
        items,
        createdAt: new Date().toISOString(),
      };
      const updated = [newSale, ...sales];
      setLocalItem("billflow-offline-sales", updated);
      return newSale as T;
    }
  }

  // /api/expenses
  if (path === "/api/expenses") {
    const expenses = getLocalItem<any[]>("billflow-offline-expenses", []);
    if (method === "GET") return expenses as T;
    if (method === "POST") {
      const rawItems = parsedBody.items || [];
      const computedItems = rawItems.map((it: any, idx: number) => {
        const qty = Number(it.quantity) || 1;
        const unitPriceCents = Number(it.unitPriceCents) || 0;
        return {
          id: idx + 1,
          categoryName: String(it.categoryName || "General"),
          productName: String(it.productName || "Expense Item"),
          quantity: qty,
          unit: String(it.unit || "item"),
          unitPriceCents,
          lineTotalCents: Math.round(qty * unitPriceCents),
        };
      });

      const totalCents = computedItems.reduce((acc: number, x: any) => acc + x.lineTotalCents, 0) || Number(parsedBody.totalCents) || 0;
      const localUser = getLocalItem<any>("billflow-local-user", null);
      const nextExpId = expenses.reduce((max, e) => Math.max(max, Number(e.id) || 0), 0) + 1;

      const newExp = {
        id: nextExpId,
        shopId: Number(parsedBody.shopId) || 1,
        supplier: parsedBody.supplier || "",
        invoiceReference: parsedBody.invoiceReference || "",
        employeeName: localUser?.name || "Store Owner",
        paymentMethod: parsedBody.paymentMethod || "cash",
        note: parsedBody.note || "",
        totalCents,
        expenseDate: parsedBody.expenseDate || new Date().toISOString().slice(0, 10),
        items: computedItems,
        createdAt: new Date().toISOString(),
      };
      const updated = [newExp, ...expenses];
      setLocalItem("billflow-offline-expenses", updated);
      return newExp as T;
    }
  }

  // /api/dashboard
  if (path === "/api/dashboard") {
    const sales = getLocalItem<any[]>("billflow-offline-sales", []);
    const expenses = getLocalItem<any[]>("billflow-offline-expenses", []);
    const salesCents = sales.reduce((acc: number, s: any) => acc + (s.totalCents || 0), 0);
    const expensesCents = expenses.reduce((acc: number, e: any) => acc + (e.totalCents || 0), 0);
    const billCount = sales.length;
    const averageBillCents = billCount > 0 ? Math.round(salesCents / billCount) : 0;
    const operatingBalanceCents = salesCents - expensesCents;

    const paymentMap = new Map<string, number>();
    for (const s of sales) {
      const m = (s.paymentMethod || "cash").toLowerCase();
      paymentMap.set(m, (paymentMap.get(m) || 0) + (s.totalCents || 0));
    }
    const payments = Array.from(paymentMap.entries()).map(([method, totalCents]) => ({ method, totalCents }));

    return {
      salesCents,
      expensesCents,
      operatingBalanceCents,
      billCount,
      averageBillCents,
      recentSales: sales.slice(0, 8),
      salesByDay: [
        { date: new Date().toISOString().slice(0, 10), totalCents: salesCents },
      ],
      payments,
    } as T;
  }

  // /api/reports/sales
  if (path === "/api/reports/sales") {
    const sales = getLocalItem<any[]>("billflow-offline-sales", []);
    const from = urlObj.searchParams.get("from");
    const to = urlObj.searchParams.get("to");
    let filtered = sales;
    if (from) filtered = filtered.filter(s => s.createdAt.slice(0, 10) >= from);
    if (to) filtered = filtered.filter(s => s.createdAt.slice(0, 10) <= to);

    const totalCents = filtered.reduce((acc: number, s: any) => acc + (s.totalCents || 0), 0);
    const discountCents = filtered.reduce((acc: number, s: any) => acc + (s.discountCents || 0), 0);
    const taxCents = filtered.reduce((acc: number, s: any) => acc + (s.taxCents || 0), 0);
    const parcelCents = filtered.reduce((acc: number, s: any) => acc + (s.parcelCents || 0), 0);

    const byEmpMap: Record<string, { employeeName: string; billCount: number; totalCents: number }> = {};
    for (const s of filtered) {
      const emp = s.employeeName || "Store Owner";
      if (!byEmpMap[emp]) byEmpMap[emp] = { employeeName: emp, billCount: 0, totalCents: 0 };
      byEmpMap[emp].billCount += 1;
      byEmpMap[emp].totalCents += (s.totalCents || 0);
    }
    const byEmployee = Object.values(byEmpMap);

    const byPayMap: Record<string, { method: string; totalCents: number }> = {};
    for (const s of filtered) {
      const pay = s.paymentMethod || "cash";
      if (!byPayMap[pay]) byPayMap[pay] = { method: pay, totalCents: 0 };
      byPayMap[pay].totalCents += (s.totalCents || 0);
    }
    const byPayment = Object.values(byPayMap);

    return {
      sales: filtered,
      totalCents,
      discountCents,
      taxCents,
      parcelCents,
      billCount: filtered.length,
      byEmployee,
      byPayment,
    } as T;
  }

  // /api/reports/expenses
  if (path === "/api/reports/expenses") {
    const expenses = getLocalItem<any[]>("billflow-offline-expenses", []);
    const from = urlObj.searchParams.get("from");
    const to = urlObj.searchParams.get("to");
    let filtered = expenses;
    if (from) filtered = filtered.filter(e => e.expenseDate >= from);
    if (to) filtered = filtered.filter(e => e.expenseDate <= to);

    const totalCents = filtered.reduce((acc: number, e: any) => acc + (e.totalCents || 0), 0);

    const byCatMap: Record<string, { categoryName: string; totalCents: number }> = {};
    for (const e of filtered) {
      if (e.items && Array.isArray(e.items) && e.items.length) {
        for (const it of e.items) {
          const cat = it.categoryName || "General";
          if (!byCatMap[cat]) byCatMap[cat] = { categoryName: cat, totalCents: 0 };
          byCatMap[cat].totalCents += (it.lineTotalCents || 0);
        }
      } else {
        const cat = "General";
        if (!byCatMap[cat]) byCatMap[cat] = { categoryName: cat, totalCents: 0 };
        byCatMap[cat].totalCents += (e.totalCents || 0);
      }
    }
    const byCategory = Object.values(byCatMap);

    return {
      expenses: filtered,
      totalCents,
      byCategory,
    } as T;
  }

  return [] as unknown as T;
}
