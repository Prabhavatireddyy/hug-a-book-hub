export type BookHugRole = "reader" | "seller" | "library" | "admin";

export type SessionUser = {
  id: number | string;
  email: string;
  petName: string;
  avatarUrl?: string;
  city?: string | null;
  role?: BookHugRole | null;
  storeName?: string | null;
  libraryName?: string | null;
  libraryStatus?: "pending" | "approved" | "rejected" | null;
};

export type SearchListing = {
  id: number | string;
  ownerPetName: string;
  ownerRole: "reader" | "seller" | "library";
  title: string;
  author?: string | null;
  listingType: "sell" | "exchange" | "library";
  price?: number | null;
  distanceKm?: number | string;
  coverUrl?: string | null;
  city?: string | null;
};

export type SearchResponse = {
  query: string;
  mode: string;
  nearby: SearchListing[];
  sellers: SearchListing[];
  libraries: SearchListing[];
  onlinePrices: Array<{ store: string; price: number; url: string }>;
};

export type PublicProfile = {
  id?: number | string;
  petName: string;
  email?: string;
  avatarUrl?: string;
  city?: string | null;
  role?: BookHugRole | null;
  storeName?: string | null;
  libraryName?: string | null;
  libraryStatus?: "pending" | "approved" | "rejected" | null;
  listings: Array<{
    id: number | string;
    title: string;
    author?: string | null;
    listingType: "sell" | "exchange" | "library";
    price?: number | null;
    status?: string;
    coverUrl?: string | null;
  }>;
};

export type AppNotification = {
  id: number | string;
  type: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
};

export type OnboardingPayload = {
  role: "reader" | "seller" | "library";
  petName: string;
  city: string;
  storeName?: string;
  libraryName?: string;
};

const RAW_BACKEND_URL = import.meta.env.VITE_PC_BACKEND_URL?.trim();
export const BOOKHUG_BACKEND_URL = (RAW_BACKEND_URL || "http://localhost:8788").replace(/\/$/, "");

async function requestJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const isFormData = typeof FormData !== "undefined" && init.body instanceof FormData;
  const headers = new Headers(init.headers);

  if (!isFormData && init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${BOOKHUG_BACKEND_URL}${path}`, {
    ...init,
    headers,
    credentials: "include",
  });

  const text = await response.text();
  const data = text ? (JSON.parse(text) as T & { error?: string }) : ({} as T & { error?: string });

  if (!response.ok) {
    throw new Error((data as { error?: string }).error || `Request failed with status ${response.status}`);
  }

  return data;
}

export const bookhugApi = {
  backendUrl: BOOKHUG_BACKEND_URL,
  async getHealth() {
    return requestJson<{
      ok: boolean;
      service: string;
      database: string;
      googleAuth: string;
      publicBaseUrl: string;
      frontendOrigin: string | null;
    }>("/api/health");
  },
  async startGoogleLogin(redirectTo = "/onboarding") {
    return requestJson<{ url: string }>("/api/auth/google/start", {
      method: "POST",
      body: JSON.stringify({ redirectTo }),
    });
  },
  async getMe() {
    return requestJson<{ user: SessionUser }>("/api/me");
  },
  async logout() {
    return requestJson<{ ok: boolean }>("/api/logout", { method: "POST" });
  },
  async completeOnboarding(payload: OnboardingPayload) {
    return requestJson<{ user: SessionUser }>("/api/onboarding", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  async searchBooks(query: string, mode = "all") {
    const params = new URLSearchParams();
    params.set("q", query);
    params.set("mode", mode);
    return requestJson<SearchResponse>(`/api/search?${params.toString()}`);
  },
  async getUserProfile(petName: string) {
    return requestJson<PublicProfile>(`/api/users/${encodeURIComponent(petName)}`);
  },
  async getNotifications() {
    return requestJson<{ notifications: AppNotification[] }>("/api/notifications");
  },
  async sendRequest(type: "buy" | "exchange", payload: { listingId: number | string; toPetName: string }) {
    return requestJson<{ ok: boolean; requestId?: number | string; toPetName?: string }>(`/api/requests/${type}`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
};
