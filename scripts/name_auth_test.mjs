import WebSocket from "ws";
globalThis.WebSocket = WebSocket;
import { createClient } from "@supabase/supabase-js";

const URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const ts = Date.now();
let pass = 0, fail = 0;
const ok = (m) => { pass++; console.log("  \u2713 " + m); };
const bad = (m, e) => { fail++; console.log("  \u2717 " + m + " -> " + (e?.message || JSON.stringify(e))); };

const DOMAIN = "couling.app";
const nameToEmail = (name) => {
  const slug = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, ".").replace(/\.{2,}/g, ".").replace(/^\.+|\.+$/g, "");
  return { slug, email: `${slug}@${DOMAIN}` };
};
const mk = () => createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } });

async function signUpByName(client, name, password) {
  const { email } = nameToEmail(name);
  const { data, error } = await client.auth.signUp({ email, password });
  if (error) throw error;
  if (!data.session) throw new Error("no session (confirmation still ON?)");
  await client.from("profiles").upsert(
    { id: data.user.id, email, name, is_online: true, last_seen: new Date().toISOString() },
    { onConflict: "id" });
  return data.user.id;
}

async function main() {
  const A = mk(), B = mk();
  const nameA = `Alice Wonder ${ts}`, nameB = `Bob Marley ${ts}`;
  let uidA, uidB;

  console.log("\n=== NAME + PASSWORD SIGNUP ===");
  try { uidA = await signUpByName(A, nameA, "secret123"); ok(`A registered by name "${nameA}"`); }
  catch (e) { bad("signUp A by name", e); return; }
  try { uidB = await signUpByName(B, nameB, "secret123"); ok(`B registered by name "${nameB}"`); }
  catch (e) { bad("signUp B by name", e); return; }

  console.log("\n=== SIGN IN BY NAME ===");
  try {
    const A2 = mk();
    const { email } = nameToEmail(nameA);
    const { data, error } = await A2.auth.signInWithPassword({ email, password: "secret123" });
    if (error) throw error;
    if (!data.session?.access_token) throw new Error("no token");
    ok("A can sign in with name + password");
  } catch (e) { bad("signIn A by name", e); }

  console.log("\n=== ADD CONTACT BY NAME ===");
  try {
    const { email } = nameToEmail(nameB);
    const { data: target, error } = await A.from("profiles").select("id,email,name").eq("email", email).maybeSingle();
    if (error) throw error;
    if (!target || target.id !== uidB) throw new Error("name lookup failed");
    const { error: ie } = await A.from("contacts").insert({ owner_id: uidA, contact_user_id: uidB, display_name: "Bob" });
    if (ie) throw ie;
    ok(`A found B by name and added to Circle (display: "${target.name}")`);
  } catch (e) { bad("addContactByName", e); }

  console.log("\n=== CHAT ACROSS NAME-BASED USERS ===");
  const chatId = "chat_" + [uidA, uidB].sort().join("_");
  try {
    await A.from("chats").upsert({ id: chatId, participant_ids: [uidA, uidB].sort() }, { onConflict: "id" });
    const { data: msg, error } = await A.from("messages").insert({ chat_id: chatId, sender_id: uidA, text: "hi from name-based Alice" }).select().single();
    if (error) throw error;
    const { data: read } = await B.from("messages").select("*").eq("chat_id", chatId);
    if (read.find((m) => m.id === msg.id)) ok("B (name-based) received A's message under RLS");
    else throw new Error("B could not read message");
  } catch (e) { bad("chat", e); }

  console.log("\n=== CLEANUP ===");
  try {
    await A.from("messages").delete().eq("chat_id", chatId);
    await A.from("contacts").delete().eq("owner_id", uidA);
    await A.from("chats").delete().eq("id", chatId);
    ok("cleaned up");
  } catch (e) { bad("cleanup", e); }

  console.log(`\n=== RESULT: ${pass} passed, ${fail} failed ===`);
  process.exit(fail === 0 ? 0 : 1);
}
main().catch((e) => { console.error("FATAL", e); process.exit(1); });
