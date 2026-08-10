// Thin API client for the VENEGE backend. Reads the JWT from secure storage.
import { storage } from "@/src/utils/storage";

const BASE = `${process.env.EXPO_PUBLIC_BACKEND_URL}/api`;
export const TOKEN_KEY = "venege_token";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}, auth = true): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string>) || {}),
  };
  if (auth) {
    const token = await storage.secureGet<string>(TOKEN_KEY, "");
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(`${BASE}${path}`, { ...options, headers });
  } catch {
    throw new ApiError(0, "No pudimos conectar. Verifica tu conexión e intenta de nuevo.");
  }

  if (!response.ok) {
    let detail = "Ocurrió un error inesperado.";
    try {
      const data = await response.json();
      if (data?.detail) detail = data.detail;
    } catch {
      /* ignore */
    }
    throw new ApiError(response.status, detail);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export type UserInfo = {
  username: string;
  role: string;
  role_label: string;
  is_master: boolean;
  authorized_price_count: number;
};

export type ProductSuggestion = {
  sku: string;
  rin: number;
  marca: string;
  descripcion: string;
};

export type PriceTile = {
  key: string;
  column: string;
  label: string;
  currency: string;
  position: number;
  value: number | null;
};

export type ProductDetail = ProductSuggestion & { prices: PriceTile[] };

export type HistoryItem = {
  sku: string;
  marca: string;
  descripcion: string;
  at: string;
  username?: string;
};

export const api = {
  login: (username: string, password: string) =>
    request<{ access_token: string; user: UserInfo }>(
      "/auth/login",
      { method: "POST", body: JSON.stringify({ username, password }) },
      false,
    ),
  me: () => request<UserInfo>("/auth/me"),
  search: (q: string) =>
    request<{ results: ProductSuggestion[]; count: number }>(
      `/products/search?q=${encodeURIComponent(q)}`,
    ),
  product: (sku: string) => request<ProductDetail>(`/products/${encodeURIComponent(sku)}`),
  history: () => request<{ items: HistoryItem[] }>("/history"),
  logHistory: (p: { sku: string; marca: string; descripcion: string }) =>
    request<{ ok: boolean }>("/history", { method: "POST", body: JSON.stringify(p) }),
  refresh: () =>
    request<{ ok: boolean; product_count: number; last_sync: string | null; refreshed_at: string }>(
      "/refresh",
      { method: "POST" },
    ),
  adminDashboard: () =>
    request<{
      product_count: number;
      last_sync: string | null;
      source: string;
      worksheet: string;
      connection_ready: boolean;
      recent_global_searches: HistoryItem[];
      activity: HistoryItem[];
      total_users: number;
    }>("/admin/dashboard"),
  adminSync: () =>
    request<{ ok: boolean; last_sync: string; source: string; row_count: number }>("/admin/sync", {
      method: "POST",
    }),
  adminProducts: () => request<{ products: ProductDetail[]; count: number }>("/admin/products"),
};
