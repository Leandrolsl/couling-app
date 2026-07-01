import { storage } from "@/src/utils/storage";

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL;

export type ApiOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: any;
  auth?: boolean;
};

async function getToken(): Promise<string | null> {
  return await storage.getItem<string>("couling.token", "");
}

export async function api<T = any>(path: string, opts: ApiOptions = {}): Promise<T> {
  const { method = "GET", body, auth = true } = opts;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (auth) {
    const token = await getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    const msg = data?.detail || data?.message || `Request failed (${res.status})`;
    throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
  }
  return data as T;
}

export const auth = {
  sendOtp: (phone: string) => api("/auth/send-otp", { method: "POST", body: { phone }, auth: false }),
  verifyOtp: (phone: string, otp: string) =>
    api("/auth/verify-otp", { method: "POST", body: { phone, otp }, auth: false }),
  updateProfile: (name: string, avatar?: string) =>
    api("/auth/profile", { method: "POST", body: { name, avatar } }),
  me: () => api("/me"),
};

export const contacts = {
  add: (phone: string, displayName: string) =>
    api("/contacts/add", { method: "POST", body: { phone, display_name: displayName } }),
  list: () => api("/contacts"),
};

export const chats = {
  start: (contactId: string) =>
    api("/chats/start", { method: "POST", body: { contact_id: contactId } }),
  list: () => api("/chats"),
  messages: (chatId: string) => api(`/chats/${chatId}/messages`),
  send: (chatId: string, text: string) =>
    api(`/chats/${chatId}/messages`, { method: "POST", body: { text } }),
  deleteMessage: (chatId: string, msgId: string, scope: "me" | "everyone") =>
    api(`/chats/${chatId}/messages/${msgId}?scope=${scope}`, { method: "DELETE" }),
  clear: (chatId: string) =>
    api(`/chats/${chatId}/clear`, { method: "POST" }),
  setDisappearing: (chatId: string, seconds: number | null) =>
    api(`/chats/${chatId}/disappearing`, { method: "POST", body: { seconds } }),
};

export const calls = {
  initiate: (contactId: string, type: "voice" | "video") =>
    api("/calls/initiate", { method: "POST", body: { contact_id: contactId, type } }),
  list: () => api("/calls"),
};

export const meetings = {
  create: (title: string) => api("/meetings", { method: "POST", body: { title } }),
  join: (code: string) => api("/meetings/join", { method: "POST", body: { code } }),
  list: () => api("/meetings"),
  get: (id: string) => api(`/meetings/${id}`),
  muteAll: (id: string) => api(`/meetings/${id}/mute-all`, { method: "POST" }),
  unmuteAll: (id: string) => api(`/meetings/${id}/unmute-all`, { method: "POST" }),
  privateTalk: (id: string, participantIds: string[]) =>
    api(`/meetings/${id}/private-talk`, { method: "POST", body: { participant_ids: participantIds } }),
  endPrivateTalk: (id: string) =>
    api(`/meetings/${id}/private-talk/end`, { method: "POST" }),
  end: (id: string) => api(`/meetings/${id}/end`, { method: "POST" }),
  leave: (id: string) => api(`/meetings/${id}/leave`, { method: "POST" }),
};

export async function setToken(token: string) {
  await storage.setItem("couling.token", token);
}

export async function clearToken() {
  await storage.removeItem("couling.token");
}

export async function getStoredToken() {
  return await storage.getItem<string>("couling.token", "");
}
