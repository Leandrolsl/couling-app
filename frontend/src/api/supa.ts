import { supabase } from "@/src/lib/supabase";

export type Profile = {
  id: string;
  phone: string | null;
  email: string | null;
  name: string;
  avatar: string;
  is_online?: boolean;
  last_seen?: string;
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

export type Meeting = {
  id: string;
  code: string;
  title: string;
  organizer_id: string;
  participants: string[];
  muted: string[];
  all_muted: boolean;
  private_talk: { members: string[]; started_at: string } | null;
  status: "live" | "ended";
  created_at: string;
};

// ---------- email auth (current) ----------
export async function signUpWithEmail(email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({
    email: email.trim().toLowerCase(),
    password,
  });
  if (error) throw error;
  const user = data.user;
  if (!user) throw new Error("Sign-up failed. Please try again.");
  // When the Supabase project requires email confirmation, no session is
  // returned yet — we cannot write the profile row (RLS needs an authed user).
  // The profile is bootstrapped on first sign-in instead (see signInWithEmail).
  if (!data.session) {
    return { user, needsConfirmation: true as const };
  }
  // Bootstrap profile row (id == auth user id)
  const { error: upErr } = await supabase.from("profiles").upsert(
    {
      id: user.id,
      email: email.trim().toLowerCase(),
      is_online: true,
      last_seen: new Date().toISOString(),
    },
    { onConflict: "id" },
  );
  if (upErr) throw upErr;
  return { user, needsConfirmation: false as const };
}

export async function signInWithEmail(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });
  if (error) throw error;
  const user = data.user;
  if (!user) throw new Error("Sign-in succeeded but no user returned.");
  // Ensure profile exists (idempotent)
  await supabase.from("profiles").upsert(
    {
      id: user.id,
      email: email.trim().toLowerCase(),
      is_online: true,
      last_seen: new Date().toISOString(),
    },
    { onConflict: "id" },
  );
  return user;
}

// ---------- name + password auth (login uses a hidden synthetic email) ----------
export const AUTH_EMAIL_DOMAIN = "couling.app";

export function usernameToEmail(name: string): { slug: string; email: string } {
  const slug = (name || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/\.{2,}/g, ".")
    .replace(/^\.+|\.+$/g, "");
  return { slug, email: slug ? `${slug}@${AUTH_EMAIL_DOMAIN}` : "" };
}

export async function signUpWithName(name: string, password: string) {
  const trimmed = (name || "").trim();
  const { slug, email } = usernameToEmail(trimmed);
  if (!slug) throw new Error("Choose a name with letters or numbers.");
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) {
    if (/already registered|already exists|already been registered/i.test(error.message))
      throw new Error("That name is already taken. Try another.");
    throw error;
  }
  const user = data.user;
  if (!user) throw new Error("Sign-up failed. Please try again.");
  if (!data.session) return { user, needsConfirmation: true as const };
  await supabase.from("profiles").upsert(
    { id: user.id, email, name: trimmed, is_online: true, last_seen: new Date().toISOString() },
    { onConflict: "id" },
  );
  return { user, needsConfirmation: false as const };
}

export async function signInWithName(name: string, password: string) {
  const trimmed = (name || "").trim();
  const { slug, email } = usernameToEmail(trimmed);
  if (!slug) throw new Error("Enter your name.");
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    if (/invalid login credentials/i.test(error.message))
      throw new Error("Wrong name or password.");
    throw error;
  }
  const user = data.user;
  if (!user) throw new Error("Sign-in failed.");
  await supabase.from("profiles").upsert(
    { id: user.id, email, name: trimmed, is_online: true, last_seen: new Date().toISOString() },
    { onConflict: "id" },
  );
  return user;
}

// ---------- phone auth (FUTURE — placeholder so screens compile) ----------
export async function startPhoneOtp(_phone: string): Promise<void> {
  throw new Error("Phone/SMS login is coming soon — please use email for now.");
}

export async function verifyPhoneOtp(_phone: string, _code: string): Promise<void> {
  throw new Error("Phone/SMS login is coming soon — please use email for now.");
}

// ---------- profile ----------
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
  try {
    await heartbeat(false);
  } catch {}
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

// ---------- contacts (look up by EMAIL — phone is future) ----------
export async function addContactByEmail(email: string, displayName: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const normalized = email.trim().toLowerCase();
  const { data: targetRow, error: lookupErr } = await supabase
    .from("profiles")
    .select("id, email")
    .eq("email", normalized)
    .maybeSingle();
  if (lookupErr) throw lookupErr;
  if (!targetRow) {
    throw new Error("No Couling user found with that email. Ask them to join.");
  }
  if (targetRow.id === user.id) throw new Error("Cannot add yourself");

  const { error } = await supabase.from("contacts").insert({
    owner_id: user.id,
    contact_user_id: targetRow.id,
    display_name: displayName,
  });
  if (error) {
    if (error.code === "23505") throw new Error("Already in your Circle");
    throw error;
  }
}

export async function addContactByName(name: string, displayName: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { slug, email } = usernameToEmail(name);
  if (!slug) throw new Error("Enter a valid name.");
  const { data: targetRow, error: lookupErr } = await supabase
    .from("profiles")
    .select("id, email")
    .eq("email", email)
    .maybeSingle();
  if (lookupErr) throw lookupErr;
  if (!targetRow) throw new Error("No Couling user found with that name. Ask them to join.");
  if (targetRow.id === user.id) throw new Error("Cannot add yourself");
  const { error } = await supabase.from("contacts").insert({
    owner_id: user.id,
    contact_user_id: targetRow.id,
    display_name: displayName,
  });
  if (error) {
    if (error.code === "23505") throw new Error("Already in your Circle");
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

  const clearedAt = (chat.cleared_at || {})[user.id];

  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("chat_id", chatId)
    .order("created_at", { ascending: true });
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

// ---------- calls (log) ----------
export async function initiateCall(contactId: string, type: "voice" | "video") {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: contact, error: cErr } = await supabase
    .from("contacts")
    .select("contact_user_id, display_name")
    .eq("id", contactId)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (cErr) throw cErr;
  if (!contact) throw new Error("Contact not found");

  const { data: target } = await supabase
    .from("profiles")
    .select("id, avatar")
    .eq("id", contact.contact_user_id)
    .maybeSingle();

  const { data: call, error } = await supabase
    .from("calls")
    .insert({
      caller_id: user.id,
      callee_id: contact.contact_user_id,
      type,
      status: "initiated",
    })
    .select()
    .single();
  if (error) throw error;
  return {
    call_id: call.id,
    type,
    peer: {
      id: target?.id || contact.contact_user_id,
      display_name: contact.display_name,
      avatar: target?.avatar || "",
    },
  };
}

export async function listCalls() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data: rows, error } = await supabase
    .from("calls")
    .select("*")
    .or(`caller_id.eq.${user.id},callee_id.eq.${user.id}`)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  if (!rows || rows.length === 0) return [];

  const otherIds = Array.from(
    new Set(rows.map((c: any) => (c.caller_id === user.id ? c.callee_id : c.caller_id))),
  );
  const { data: profs } = await supabase
    .from("profiles")
    .select("id, name, avatar")
    .in("id", otherIds);
  const profMap = new Map<string, any>((profs || []).map((p: any) => [p.id, p]));

  const { data: cts } = await supabase
    .from("contacts")
    .select("contact_user_id, display_name")
    .eq("owner_id", user.id);
  const ctMap = new Map<string, string>((cts || []).map((c: any) => [c.contact_user_id, c.display_name]));

  return rows.map((c: any) => {
    const outgoing = c.caller_id === user.id;
    const otherId = outgoing ? c.callee_id : c.caller_id;
    const prof = profMap.get(otherId) || {};
    return {
      id: c.id,
      type: c.type as "voice" | "video",
      direction: outgoing ? "outgoing" : "incoming",
      display_name: ctMap.get(otherId) || prof.name || "Couling User",
      avatar: prof.avatar || "",
      created_at: c.created_at,
    };
  });
}

// ---------- meetings ----------
function genMeetingCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const block = () => Array.from({ length: 3 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  return `${block()}-${block()}-${block()}`;
}

export async function createMeeting(title: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Retry once on unique-code collision
  for (let attempt = 0; attempt < 3; attempt++) {
    const code = genMeetingCode();
    const { data, error } = await supabase
      .from("meetings")
      .insert({
        code,
        title: title.trim() || "Couling Meeting",
        organizer_id: user.id,
        participants: [user.id],
      })
      .select()
      .single();
    if (!error) return data as Meeting;
    if (error.code !== "23505") throw error;
  }
  throw new Error("Could not allocate meeting code, please retry.");
}

export async function joinMeeting(code: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const upper = code.trim().toUpperCase();
  const { data: meeting, error } = await supabase
    .from("meetings")
    .select("*")
    .eq("code", upper)
    .maybeSingle();
  if (error) throw error;
  if (!meeting || meeting.status !== "live") {
    throw new Error("Meeting not found or ended");
  }

  if (!meeting.participants.includes(user.id)) {
    const next = [...meeting.participants, user.id];
    const { error: upErr } = await supabase
      .from("meetings")
      .update({ participants: next })
      .eq("id", meeting.id);
    if (upErr) throw upErr;
    meeting.participants = next;
  }
  return meeting as Meeting;
}

export async function listMeetings() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from("meetings")
    .select("*")
    .contains("participants", [user.id])
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []).map((m: any) => ({ ...m, is_organizer: m.organizer_id === user.id }));
}

export async function getMeeting(meetingId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data: meeting, error } = await supabase
    .from("meetings")
    .select("*")
    .eq("id", meetingId)
    .maybeSingle();
  if (error) throw error;
  if (!meeting) throw new Error("Meeting not found");

  // Resolve participants with profile + contact display name overrides
  const { data: profs } = await supabase
    .from("profiles")
    .select("id, name, avatar")
    .in("id", meeting.participants);
  const profMap = new Map<string, any>((profs || []).map((p: any) => [p.id, p]));

  const { data: cts } = await supabase
    .from("contacts")
    .select("contact_user_id, display_name")
    .eq("owner_id", user.id);
  const ctMap = new Map<string, string>((cts || []).map((c: any) => [c.contact_user_id, c.display_name]));

  const participants_detail = meeting.participants.map((pid: string) => {
    const prof = profMap.get(pid) || {};
    const display =
      pid === user.id
        ? "You"
        : ctMap.get(pid) || prof.name || "Couling User";
    return {
      user_id: pid,
      display_name: display,
      avatar: prof.avatar || "",
      is_organizer: pid === meeting.organizer_id,
      muted: (meeting.muted || []).includes(pid),
    };
  });

  return {
    ...meeting,
    is_organizer: meeting.organizer_id === user.id,
    participants_detail,
  };
}

export async function muteAll(meetingId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data: meeting } = await supabase
    .from("meetings").select("organizer_id, participants").eq("id", meetingId).maybeSingle();
  if (!meeting) throw new Error("Meeting not found");
  if (meeting.organizer_id !== user.id) throw new Error("Only organizer can mute all");
  const muted = (meeting.participants || []).filter((p: string) => p !== user.id);
  const { error } = await supabase
    .from("meetings")
    .update({ muted, all_muted: true })
    .eq("id", meetingId);
  if (error) throw error;
}

export async function unmuteAll(meetingId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data: meeting } = await supabase
    .from("meetings").select("organizer_id").eq("id", meetingId).maybeSingle();
  if (!meeting) throw new Error("Meeting not found");
  if (meeting.organizer_id !== user.id) throw new Error("Only organizer can unmute all");
  const { error } = await supabase
    .from("meetings")
    .update({ muted: [], all_muted: false })
    .eq("id", meetingId);
  if (error) throw error;
}

export async function startPrivateTalk(meetingId: string, participantIds: string[]) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data: meeting } = await supabase
    .from("meetings").select("organizer_id, participants").eq("id", meetingId).maybeSingle();
  if (!meeting) throw new Error("Meeting not found");
  if (meeting.organizer_id !== user.id) throw new Error("Only organizer can start private talk");
  const ids = Array.from(new Set([user.id, ...participantIds]));
  const invalid = ids.filter((p) => !meeting.participants.includes(p));
  if (invalid.length > 0) throw new Error("Selected user not in meeting");
  const pt = { members: ids, started_at: new Date().toISOString() };
  const { error } = await supabase
    .from("meetings")
    .update({ private_talk: pt })
    .eq("id", meetingId);
  if (error) throw error;
  return pt;
}

export async function endPrivateTalk(meetingId: string) {
  const { error } = await supabase
    .from("meetings")
    .update({ private_talk: null })
    .eq("id", meetingId);
  if (error) throw error;
}

export async function endMeeting(meetingId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data: meeting } = await supabase
    .from("meetings").select("organizer_id").eq("id", meetingId).maybeSingle();
  if (!meeting) throw new Error("Meeting not found");
  if (meeting.organizer_id !== user.id) throw new Error("Only organizer can end");
  const { error } = await supabase
    .from("meetings")
    .update({ status: "ended" })
    .eq("id", meetingId);
  if (error) throw error;
}

export async function leaveMeeting(meetingId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data: meeting } = await supabase
    .from("meetings").select("organizer_id, participants").eq("id", meetingId).maybeSingle();
  if (!meeting) return;
  const parts = (meeting.participants || []).filter((p: string) => p !== user.id);
  const update: any = { participants: parts };
  if (meeting.organizer_id === user.id) update.status = "ended";
  await supabase.from("meetings").update(update).eq("id", meetingId);
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

export function subscribeMeeting(meetingId: string, onUpdate: (m: any) => void) {
  const channel = supabase
    .channel(`meeting:${meetingId}`)
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "meetings", filter: `id=eq.${meetingId}` },
      (payload) => onUpdate(payload.new),
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
