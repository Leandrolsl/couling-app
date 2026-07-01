import WebSocket from "ws";
globalThis.WebSocket = WebSocket;
import { createClient } from "@supabase/supabase-js";

const URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const ts = Date.now();
let pass = 0, fail = 0;
const ok = (m) => { pass++; console.log("  \u2713 " + m); };
const bad = (m, e) => { fail++; console.log("  \u2717 " + m + " -> " + (e?.message || e)); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function mk() {
  return createClient(URL, KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    realtime: { transport: WebSocket },
  });
}

const A = mk();
const B = mk();
let uidA, uidB, chatId, meetingCode, meetingId, contactAId;
const emailA = `alice.${ts}@couling.dev`;
const emailB = `bob.${ts}@couling.dev`;

async function main() {
  console.log("\n=== 1. AUTH (registration/login) ===");
  try {
    const { data, error } = await A.auth.signInAnonymously();
    if (error) throw error;
    uidA = data.user.id;
    if (!data.session?.access_token) throw new Error("no session token");
    ok(`User A authenticated session issued (uid ${uidA.slice(0,8)})`);
  } catch (e) { bad("User A auth", e); return; }
  try {
    const { data, error } = await B.auth.signInAnonymously();
    if (error) throw error;
    uidB = data.user.id;
    ok(`User B authenticated session issued (uid ${uidB.slice(0,8)})`);
  } catch (e) { bad("User B auth", e); return; }

  // Email registration endpoint reachable (may be rate limited)
  try {
    const C = mk();
    const { data, error } = await C.auth.signUp({ email: `reg.${ts}@couling.dev`, password: "secret123" });
    if (error) {
      if (String(error.message).toLowerCase().includes("rate")) ok("Email signUp endpoint reachable (rate-limited 429 - expected)");
      else bad("Email signUp", error);
    } else {
      ok(`Email signUp OK (user ${data.user?.id?.slice(0,8)}, needsConfirmation=${!data.session})`);
    }
  } catch (e) { bad("Email signUp", e); }

  console.log("\n=== 2. PROFILES ===");
  try {
    const { error } = await A.from("profiles").upsert({ id: uidA, name: "Alice", email: emailA, avatar: "\ud83e\udd8a", is_online: true, last_seen: new Date().toISOString() }, { onConflict: "id" });
    if (error) throw error;
    ok("Profile A created (name+email under RLS)");
  } catch (e) { bad("Profile A", e); }
  try {
    const { error } = await B.from("profiles").upsert({ id: uidB, name: "Bob", email: emailB, avatar: "\ud83d\udc3b", is_online: true, last_seen: new Date().toISOString() }, { onConflict: "id" });
    if (error) throw error;
    ok("Profile B created");
  } catch (e) { bad("Profile B", e); }

  console.log("\n=== 3. CONTACTS (add by email) ===");
  try {
    const { data: target, error: le } = await A.from("profiles").select("id,email").eq("email", emailB).maybeSingle();
    if (le) throw le;
    if (!target) throw new Error("email lookup failed");
    const { data: ins, error } = await A.from("contacts").insert({ owner_id: uidA, contact_user_id: target.id, display_name: "Bob (work)" }).select().single();
    if (error) throw error;
    contactAId = ins.id;
    ok("A added B as contact by email");
  } catch (e) { bad("addContactByEmail", e); }
  try {
    const { data, error } = await A.from("contacts").select("*").eq("owner_id", uidA);
    if (error) throw error;
    if (data.find((c) => c.contact_user_id === uidB)) ok("A's contact list shows B");
    else throw new Error("B not in list");
  } catch (e) { bad("listContacts", e); }

  console.log("\n=== 4. CHAT + REALTIME ===");
  chatId = "chat_" + [uidA, uidB].sort().join("_");
  try {
    const { error } = await A.from("chats").upsert({ id: chatId, participant_ids: [uidA, uidB].sort(), last_at: new Date().toISOString() }, { onConflict: "id" });
    if (error) throw error;
    ok("Chat created between A and B");
  } catch (e) { bad("startChat", e); }

  // B subscribes to realtime; A sends; assert B receives
  let received = null;
  const chan = B.channel(`messages:${chatId}`)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `chat_id=eq.${chatId}` },
      (p) => { received = p.new; });
  try {
    await new Promise((res, rej) => {
      const t = setTimeout(() => rej(new Error("subscribe timeout")), 12000);
      chan.subscribe((status) => { if (status === "SUBSCRIBED") { clearTimeout(t); res(); } if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") { clearTimeout(t); rej(new Error(status)); } });
    });
    ok("B subscribed to chat realtime channel");
  } catch (e) { bad("realtime subscribe", e); }

  let msgId;
  try {
    const { data, error } = await A.from("messages").insert({ chat_id: chatId, sender_id: uidA, text: "Hello Bob, this is Alice!" }).select().single();
    if (error) throw error;
    msgId = data.id;
    await A.from("chats").update({ last_message: "Hello Bob, this is Alice!", last_at: new Date().toISOString() }).eq("id", chatId);
    ok("A sent a message");
  } catch (e) { bad("sendMessage A", e); }

  try {
    for (let i = 0; i < 30 && !received; i++) await sleep(300);
    if (received && received.id === msgId) ok("B received A's message via REALTIME");
    else throw new Error("no realtime event");
  } catch (e) { bad("realtime delivery", e); }

  // Cross-user read (RLS) B reads A's message
  try {
    const { data, error } = await B.from("messages").select("*").eq("chat_id", chatId).order("created_at");
    if (error) throw error;
    if (data.find((m) => m.id === msgId)) ok("B can read A's message (RLS participant access)");
    else throw new Error("B cannot read message");
  } catch (e) { bad("cross-user read", e); }

  // B replies
  try {
    const { error } = await B.from("messages").insert({ chat_id: chatId, sender_id: uidB, text: "Hi Alice! Got it." });
    if (error) throw error;
    ok("B replied in chat");
  } catch (e) { bad("sendMessage B", e); }

  // delete for everyone (sender only)
  try {
    const { error } = await A.from("messages").update({ deleted_for_all: true, deleted_at: new Date().toISOString(), text: "" }).eq("id", msgId);
    if (error) throw error;
    ok("A deleted own message for everyone");
  } catch (e) { bad("deleteMessage everyone", e); }
  try { await chan.unsubscribe(); } catch {}

  console.log("\n=== 5. CALLS ===");
  let callId;
  try {
    const { data, error } = await A.from("calls").insert({ caller_id: uidA, callee_id: uidB, type: "voice", status: "initiated" }).select().single();
    if (error) throw error;
    callId = data.id;
    ok("A initiated a voice call to B");
  } catch (e) { bad("initiateCall", e); }
  try {
    const { data, error } = await A.from("calls").select("*").or(`caller_id.eq.${uidA},callee_id.eq.${uidA}`);
    if (error) throw error;
    if (data.find((c) => c.id === callId)) ok("A's call log shows the outgoing call"); else throw new Error("missing");
  } catch (e) { bad("listCalls A", e); }
  try {
    const { data, error } = await B.from("calls").select("*").or(`caller_id.eq.${uidB},callee_id.eq.${uidB}`);
    if (error) throw error;
    if (data.find((c) => c.id === callId)) ok("B's call log shows the incoming call"); else throw new Error("missing");
  } catch (e) { bad("listCalls B", e); }

  console.log("\n=== 6. MEETINGS ===");
  try {
    const block = () => Array.from({ length: 3 }, () => "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"[Math.floor(Math.random()*36)]).join("");
    meetingCode = `${block()}-${block()}-${block()}`;
    const { data, error } = await A.from("meetings").insert({ code: meetingCode, title: "Weekly Standup", organizer_id: uidA, participants: [uidA] }).select().single();
    if (error) throw error;
    meetingId = data.id;
    ok(`A created meeting (code ${meetingCode})`);
  } catch (e) { bad("createMeeting", e); }
  try {
    const { data: mtg, error } = await B.from("meetings").select("*").eq("code", meetingCode).maybeSingle();
    if (error) throw error;
    if (!mtg) throw new Error("code lookup failed");
    const next = [...mtg.participants, uidB];
    const { error: ue } = await B.from("meetings").update({ participants: next }).eq("id", mtg.id);
    if (ue) throw ue;
    ok("B joined the meeting by code");
  } catch (e) { bad("joinMeeting", e); }
  try {
    const { data, error } = await B.from("meetings").select("*").contains("participants", [uidB]);
    if (error) throw error;
    if (data.find((m) => m.id === meetingId)) ok("B's meeting list shows the meeting"); else throw new Error("missing");
  } catch (e) { bad("listMeetings B", e); }
  try {
    const { data: mtg } = await A.from("meetings").select("participants").eq("id", meetingId).maybeSingle();
    const muted = (mtg.participants || []).filter((p) => p !== uidA);
    const { error } = await A.from("meetings").update({ muted, all_muted: true }).eq("id", meetingId);
    if (error) throw error;
    ok("Organizer A muted all participants");
  } catch (e) { bad("muteAll", e); }
  try {
    const { error } = await A.from("meetings").update({ status: "ended" }).eq("id", meetingId);
    if (error) throw error;
    ok("Organizer A ended the meeting");
  } catch (e) { bad("endMeeting", e); }

  console.log("\n=== 7. CLEANUP ===");
  try {
    await A.from("messages").delete().eq("chat_id", chatId);
    await A.from("contacts").delete().eq("owner_id", uidA);
    await A.from("calls").delete().eq("id", callId);
    await A.from("meetings").delete().eq("id", meetingId);
    await A.from("chats").delete().eq("id", chatId);
    ok("Test rows cleaned up");
  } catch (e) { bad("cleanup", e); }

  console.log(`\n=== RESULT: ${pass} passed, ${fail} failed ===`);
  process.exit(fail === 0 ? 0 : 1);
}
main().catch((e) => { console.error("FATAL", e); process.exit(1); });
