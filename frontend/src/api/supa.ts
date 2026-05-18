import { supabase } from "@/src/lib/supabase";

export type Profile = {
  id: string;
  phone: string;
  name: string;
  avatar: string;
  is_online?: boolean;
  last_seen?: string;
};

export type ContactRow = {
  id: string;
  owner_id: string;
  contact_user_id: string;
  display_name: string;
  created_at: string;
  profile?: Profile;
};

export type Message = {
  id: string;
  chat_id: string;
  sender_id: string;
  text: string;
  hidden_for: string[];
  deleted_for_all: boolean;
  deleted_at: string | null;
  created_at: string;
};

export type Chat = {
  id: string;
  participant_ids: string[];
  last_message: string;
  last_at: string;
  disappearing_seconds: number | null;
  cleared_at: Record<string, string>;
  created_at: string;
};

// ---------- auth ----------
export async function signInDemo(phone: string) {
  // Demo OTP flow: anon sign-in then upsert profile with phone.
  // This preserves the existing UX while using REAL Supabase JWT + RLS.
  // Returning users on the SAME DEVICE keep their session; new device = new identity.
  const session = await supabase.auth.getSession();
  if (!session.data.session) {
    const { error } = await supabase.auth.signInAnonymously();
    if (error) throw error;
  }
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) throw new Error("Could not establish session");

  // Upsert profile with phone (idempotent)
  const { error: upErr } = await supabase
    .from("profiles")
    .upsert(
      { id: user.id, phone, is_online: true, last_seen: new Date().toISOString() },
      { onConflict: "id" },
    );
  if (upErr) throw upErr;
  return user;
}

export async function getCurrentProfile(): Promise<Profile | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();
  if (error) throw error;
  return (data as Profile) || null;
}

export async function updateProfile(name: string, avatar: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { error } = await supabase
    .from("profiles")
    .update({ name, avatar })
    .eq("id", user.id);
  if (error) throw error;
}

export async function signOut() {
  await supabase.auth.signOut();
}

// ---------- presence heartbeat ----------
export async function heartbeat(online: boolean) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase
    .from("profiles")
    .update({ is_online: online, last_seen: new Date().toISOString() })
    .eq("id", user.id);
}

// ---------- contacts ----------
export async function addContactByPhone(phone: string, displayName: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  if (phone === user.phone) throw new Error("Cannot add yourself");

  const { data: targetRow, error: lookupErr } = await supabase
    .from("profiles")
    .select("id, phone")
    .eq("phone", phone)
    .maybeSingle();
  if (lookupErr) throw lookupErr;
  if (!targetRow) {
    throw new Error("No Couling user found with that phone. Ask them to join.");
  }
  if (targetRow.id === user.id) throw new Error("Cannot add yourself");

  const { error } = await supabase.from("contacts").insert({
    owner_id: user.id,
    contact_user_id: targetRow.id,
    display_name: displayName,
  });
  if (error) {
    if (error.code === "23505") throw new Error("Already in contacts");
    throw error;
  }
}

export async function listContacts() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from("contacts")
    .select("id, contact_user_id, display_name, created_at")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false });
  if (error) throw error;
  if (!data || data.length === 0) return [];

  const ids = data.map((c: any) => c.contact_user_id);
  const { data: profs } = await supabase
    .from("profiles")
    .select("id, name, avatar, is_online, last_seen")
    .in("id", ids);
  const profMap = new Map<string, any>((profs || []).map((p: any) => [p.id, p]));

  return data.map((c: any) => ({
    id: c.id,
    user_id: c.contact_user_id,
    display_name: c.display_name,
    avatar: profMap.get(c.contact_user_id)?.avatar || "",
    is_online: profMap.get(c.contact_user_id)?.is_online || false,
    last_seen: profMap.get(c.contact_user_id)?.last_seen,
    hidden_phone: true,
  }));
}

// ---------- chats ----------
function chatIdFor(a: string, b: string) {
  return "chat_" + [a, b].sort().join("_");
}

export async function startChatWithContact(contactId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data: contact, error } = await supabase
    .from("contacts")
    .select("contact_user_id")
    .eq("id", contactId)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (error) throw error;
  if (!contact) throw new Error("Contact not found");

  const chatId = chatIdFor(user.id, contact.contact_user_id);
  // upsert chat row (idempotent)
  const { error: upErr } = await supabase
    .from("chats")
    .upsert(
      {
        id: chatId,
        participant_ids: [user.id, contact.contact_user_id].sort(),
        last_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    );
  if (upErr) throw upErr;
  return chatId;
}

export async function listChats() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data: chats, error } = await supabase
    .from("chats")
    .select("*")
    .contains("participant_ids", [user.id])
    .order("last_at", { ascending: false });
  if (error) throw error;
  if (!chats || chats.length === 0) return [];

  const otherIds = Array.from(
    new Set(chats.flatMap((c: any) => c.participant_ids.filter((id: string) => id !== user.id))),
  );
  const { data: profs } = await supabase
    .from("profiles")
    .select("id, name, avatar, is_online, last_seen")
    .in("id", otherIds);
  const profMap = new Map<string, any>((profs || []).map((p: any) => [p.id, p]));

  // contacts for display name override
  const { data: cts } = await supabase
    .from("contacts")
    .select("contact_user_id, display_name")
    .eq("owner_id", user.id);
  const ctMap = new Map<string, string>((cts || []).map((c: any) => [c.contact_user_id, c.display_name]));

  return chats.map((c: any) => {
    const otherId = c.participant_ids.find((id: string) => id !== user.id);
    const prof = profMap.get(otherId) || {};
    return {
      id: c.id,
      display_name: ctMap.get(otherId) || prof.name || "Couling User",
      avatar: prof.avatar || "",
      is_online: prof.is_online || false,
      last_message: c.last_message || "",
      last_at: c.last_at,
      other_user_id: otherId,
      disappearing_seconds: c.disappearing_seconds,
    };
  });
}

export async function getChat(chatId: string) {
  const { data, error } = await supabase
    .from("chats")
    .select("*")
    .eq("id", chatId)
    .maybeSingle();
  if (error) throw error;
  return data as Chat | null;
}

export async function getMessages(chatId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { messages: [], chat: null };
  const chat = await getChat(chatId);
  if (!chat) return { messages: [], chat: null };

  // Auto-purge expired (best-effort; mirror server-side logic on client only)
  // Real purge would need a server function; for now we just filter visibility.
  const clearedAt = (chat.cleared_at || {})[user.id];

  let q = supabase
    .from("messages")
    .select("*")
    .eq("chat_id", chatId)
    .order("created_at", { ascending: true });
  const { data, error } = await q;
  if (error) throw error;
  const visible = (data as Message[]).filter((m) => {
    if ((m.hidden_for || []).includes(user.id)) return false;
    if (clearedAt && m.created_at <= clearedAt) return false;
    if (chat.disappearing_seconds) {
      const expireAt = new Date(m.created_at).getTime() + chat.disappearing_seconds * 1000;
      if (Date.now() > expireAt) return false;
    }
    return true;
  });
  return { messages: visible, chat };
}

export async function sendMessage(chatId: string, text: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data, error } = await supabase
    .from("messages")
    .insert({ chat_id: chatId, sender_id: user.id, text })
    .select()
    .single();
  if (error) throw error;
  // update chat preview
  await supabase
    .from("chats")
    .update({ last_message: text.slice(0, 120), last_at: new Date().toISOString() })
    .eq("id", chatId);
  return data as Message;
}

export async function deleteMessage(chatId: string, msgId: string, scope: "me" | "everyone") {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  if (scope === "everyone") {
    const { data: msg } = await supabase
      .from("messages").select("sender_id").eq("id", msgId).maybeSingle();
    if (!msg || msg.sender_id !== user.id) throw new Error("Only the sender can delete for everyone");
    const { error } = await supabase
      .from("messages")
      .update({ deleted_for_all: true, deleted_at: new Date().toISOString(), text: "" })
      .eq("id", msgId);
    if (error) throw error;
  } else {
    const { data: msg } = await supabase
      .from("messages").select("hidden_for").eq("id", msgId).maybeSingle();
    const hidden = Array.from(new Set([...((msg?.hidden_for as string[]) || []), user.id]));
    const { error } = await supabase
      .from("messages")
      .update({ hidden_for: hidden })
      .eq("id", msgId);
    if (error) throw error;
  }
}

export async function clearChat(chatId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const chat = await getChat(chatId);
  if (!chat) throw new Error("Chat not found");
  const newCleared = { ...(chat.cleared_at || {}), [user.id]: new Date().toISOString() };
  const { error } = await supabase
    .from("chats")
    .update({ cleared_at: newCleared })
    .eq("id", chatId);
  if (error) throw error;
}

export async function setDisappearing(chatId: string, seconds: number | null) {
  if (seconds !== null && (seconds < 30 || seconds > 60 * 60 * 24 * 365)) {
    throw new Error("Timer must be between 30s and 1 year");
  }
  const { error } = await supabase
    .from("chats")
    .update({ disappearing_seconds: seconds })
    .eq("id", chatId);
  if (error) throw error;
}

// ---------- realtime helpers ----------
export function subscribeChatMessages(chatId: string, onInsert: (m: Message) => void, onUpdate?: (m: Message) => void) {
  const channel = supabase
    .channel(`messages:${chatId}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "messages", filter: `chat_id=eq.${chatId}` },
      (payload) => onInsert(payload.new as Message),
    )
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "messages", filter: `chat_id=eq.${chatId}` },
      (payload) => onUpdate?.(payload.new as Message),
    )
    .subscribe();
  return channel;
}

export function subscribePresence(
  chatId: string,
  selfPayload: { user_id: string; display_name: string },
  onSync: (state: Record<string, any[]>) => void,
) {
  const channel = supabase.channel(`presence:${chatId}`, {
    config: { presence: { key: selfPayload.user_id } },
  });
  channel
    .on("presence", { event: "sync" }, () => {
      onSync(channel.presenceState() as any);
    })
    .subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await channel.track({
          ...selfPayload,
          online_at: new Date().toISOString(),
        });
      }
    });
  return channel;
}
