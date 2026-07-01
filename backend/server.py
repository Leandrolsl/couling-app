from fastapi import FastAPI, APIRouter, HTTPException, Depends, Header
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import secrets
import string
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

app = FastAPI()
api = APIRouter(prefix="/api")


# ---------- Helpers ----------
def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def gen_code(length: int = 6) -> str:
    return "".join(secrets.choice(string.digits) for _ in range(length))


def gen_meeting_code() -> str:
    chars = string.ascii_uppercase + string.digits
    return "-".join(
        "".join(secrets.choice(chars) for _ in range(3)) for _ in range(3)
    )


async def get_user_by_token(authorization: Optional[str] = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing token")
    token = authorization.split(" ", 1)[1]
    user = await db.users.find_one({"token": token}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid token")
    return user


# ---------- Models ----------
class SendOtpIn(BaseModel):
    phone: str


class VerifyOtpIn(BaseModel):
    phone: str
    otp: str


class ProfileIn(BaseModel):
    name: str
    avatar: Optional[str] = None  # base64 or emoji


class AddContactIn(BaseModel):
    phone: str
    display_name: str


class SendMessageIn(BaseModel):
    text: str


class DeleteScopeIn(BaseModel):
    scope: str  # "me" | "everyone"


class DisappearingIn(BaseModel):
    seconds: Optional[int] = None  # null = off; e.g. 86400 (24h), 604800 (7d)


class StartChatIn(BaseModel):
    contact_id: str


class CreateMeetingIn(BaseModel):
    title: str


class JoinMeetingIn(BaseModel):
    code: str


class PrivateTalkIn(BaseModel):
    participant_ids: List[str]


class CallInitiateIn(BaseModel):
    contact_id: str
    type: str  # voice | video


# ---------- Auth ----------
@api.get("/")
async def root():
    return {"app": "Couling", "status": "online"}


@api.post("/auth/send-otp")
async def send_otp(payload: SendOtpIn):
    phone = payload.phone.strip()
    if len(phone) < 6:
        raise HTTPException(status_code=400, detail="Invalid phone")
    # Mock OTP — universal demo code
    otp = "123456"
    await db.otps.update_one(
        {"phone": phone},
        {"$set": {"phone": phone, "otp": otp, "created_at": now_iso()}},
        upsert=True,
    )
    return {"ok": True, "dev_otp": otp, "message": "OTP sent (demo: 123456)"}


@api.post("/auth/verify-otp")
async def verify_otp(payload: VerifyOtpIn):
    phone = payload.phone.strip()
    otp = payload.otp.strip()
    record = await db.otps.find_one({"phone": phone}, {"_id": 0})
    # Accept stored OTP, or universal 123456 for demo
    if not record or (record.get("otp") != otp and otp != "123456"):
        raise HTTPException(status_code=400, detail="Invalid OTP")

    user = await db.users.find_one({"phone": phone}, {"_id": 0})
    is_new = False
    if not user:
        is_new = True
        user = {
            "id": str(uuid.uuid4()),
            "phone": phone,
            "name": "",
            "avatar": "",
            "token": secrets.token_urlsafe(32),
            "created_at": now_iso(),
        }
        await db.users.insert_one(dict(user))
    else:
        # rotate token
        new_token = secrets.token_urlsafe(32)
        await db.users.update_one({"id": user["id"]}, {"$set": {"token": new_token}})
        user["token"] = new_token
    return {"token": user["token"], "user": user, "is_new": is_new}


@api.post("/auth/profile")
async def update_profile(payload: ProfileIn, user=Depends(get_user_by_token)):
    update = {"name": payload.name.strip(), "avatar": payload.avatar or ""}
    await db.users.update_one({"id": user["id"]}, {"$set": update})
    updated = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    return {"user": updated}


@api.get("/me")
async def me(user=Depends(get_user_by_token)):
    return {"user": user}


# ---------- Contacts ----------
@api.post("/contacts/add")
async def add_contact(payload: AddContactIn, user=Depends(get_user_by_token)):
    target_phone = payload.phone.strip()
    if target_phone == user["phone"]:
        raise HTTPException(status_code=400, detail="Cannot add yourself")
    target = await db.users.find_one({"phone": target_phone}, {"_id": 0})
    if not target:
        raise HTTPException(
            status_code=404,
            detail="No Couling user found with that phone. Ask them to join.",
        )
    existing = await db.contacts.find_one(
        {"owner_id": user["id"], "contact_user_id": target["id"]}, {"_id": 0}
    )
    if existing:
        raise HTTPException(status_code=400, detail="Already in contacts")
    contact = {
        "id": str(uuid.uuid4()),
        "owner_id": user["id"],
        "contact_user_id": target["id"],
        "display_name": payload.display_name.strip() or target.get("name", "Couling User"),
        "created_at": now_iso(),
    }
    await db.contacts.insert_one(dict(contact))
    return {"contact": _contact_view(contact, target)}


def _contact_view(contact, target):
    return {
        "id": contact["id"],
        "user_id": target["id"],
        "display_name": contact["display_name"],
        "avatar": target.get("avatar", ""),
        "hidden_phone": True,
        "created_at": contact.get("created_at"),
    }


@api.get("/contacts")
async def list_contacts(user=Depends(get_user_by_token)):
    contacts = await db.contacts.find({"owner_id": user["id"]}, {"_id": 0}).to_list(1000)
    out = []
    for c in contacts:
        target = await db.users.find_one({"id": c["contact_user_id"]}, {"_id": 0})
        if target:
            out.append(_contact_view(c, target))
    return {"contacts": out}


# ---------- Chats & Messages ----------
def _chat_id_for(a: str, b: str) -> str:
    return "chat_" + "_".join(sorted([a, b]))


@api.post("/chats/start")
async def start_chat(payload: StartChatIn, user=Depends(get_user_by_token)):
    contact = await db.contacts.find_one(
        {"id": payload.contact_id, "owner_id": user["id"]}, {"_id": 0}
    )
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    chat_id = _chat_id_for(user["id"], contact["contact_user_id"])
    existing = await db.chats.find_one({"id": chat_id}, {"_id": 0})
    if not existing:
        chat = {
            "id": chat_id,
            "participants": sorted([user["id"], contact["contact_user_id"]]),
            "created_at": now_iso(),
            "last_message": "",
            "last_at": now_iso(),
            "cleared_at": {},  # user_id -> iso ts; messages older than this hidden for that user
            "disappearing_seconds": None,
        }
        await db.chats.insert_one(dict(chat))
    return {"chat_id": chat_id}


@api.get("/chats")
async def list_chats(user=Depends(get_user_by_token)):
    chats = await db.chats.find({"participants": user["id"]}, {"_id": 0}).to_list(1000)
    out = []
    for c in chats:
        other_id = next((p for p in c["participants"] if p != user["id"]), None)
        if not other_id:
            continue
        contact = await db.contacts.find_one(
            {"owner_id": user["id"], "contact_user_id": other_id}, {"_id": 0}
        )
        target = await db.users.find_one({"id": other_id}, {"_id": 0})
        display_name = (
            contact["display_name"] if contact else (target.get("name") if target else "Unknown")
        )
        avatar = target.get("avatar", "") if target else ""
        out.append(
            {
                "id": c["id"],
                "display_name": display_name,
                "avatar": avatar,
                "last_message": c.get("last_message", ""),
                "last_at": c.get("last_at"),
                "other_user_id": other_id,
                "disappearing_seconds": c.get("disappearing_seconds"),
            }
        )
    out.sort(key=lambda x: x.get("last_at") or "", reverse=True)
    return {"chats": out}


def _visible_for(msg: dict, user_id: str, cleared_at_iso: Optional[str]) -> bool:
    if user_id in (msg.get("hidden_for") or []):
        return False
    if cleared_at_iso and (msg.get("created_at") or "") <= cleared_at_iso:
        return False
    return True


async def _purge_expired(chat: dict) -> None:
    """Delete messages older than chat.disappearing_seconds. Mutates DB only."""
    ttl = chat.get("disappearing_seconds")
    if not ttl:
        return
    cutoff = (datetime.now(timezone.utc) - timedelta(seconds=int(ttl))).isoformat()
    await db.messages.delete_many({"chat_id": chat["id"], "created_at": {"$lt": cutoff}})


@api.get("/chats/{chat_id}/messages")
async def get_messages(chat_id: str, user=Depends(get_user_by_token)):
    chat = await db.chats.find_one({"id": chat_id}, {"_id": 0})
    if not chat or user["id"] not in chat["participants"]:
        raise HTTPException(status_code=404, detail="Chat not found")
    await _purge_expired(chat)
    cleared_at = (chat.get("cleared_at") or {}).get(user["id"])
    raw = await db.messages.find({"chat_id": chat_id}, {"_id": 0}).sort("created_at", 1).to_list(2000)
    visible = [m for m in raw if _visible_for(m, user["id"], cleared_at)]
    return {"messages": visible, "chat": chat}


@api.post("/chats/{chat_id}/messages")
async def send_message(chat_id: str, payload: SendMessageIn, user=Depends(get_user_by_token)):
    chat = await db.chats.find_one({"id": chat_id}, {"_id": 0})
    if not chat or user["id"] not in chat["participants"]:
        raise HTTPException(status_code=404, detail="Chat not found")
    msg = {
        "id": str(uuid.uuid4()),
        "chat_id": chat_id,
        "sender_id": user["id"],
        "text": payload.text,
        "created_at": now_iso(),
        "hidden_for": [],
        "deleted_for_all": False,
        "deleted_at": None,
    }
    await db.messages.insert_one(dict(msg))
    await db.chats.update_one(
        {"id": chat_id},
        {"$set": {"last_message": payload.text[:120], "last_at": msg["created_at"]}},
    )
    return {"message": msg}


@api.delete("/chats/{chat_id}/messages/{msg_id}")
async def delete_message(
    chat_id: str,
    msg_id: str,
    scope: str = "me",
    user=Depends(get_user_by_token),
):
    chat = await db.chats.find_one({"id": chat_id}, {"_id": 0})
    if not chat or user["id"] not in chat["participants"]:
        raise HTTPException(status_code=404, detail="Chat not found")
    msg = await db.messages.find_one({"id": msg_id, "chat_id": chat_id}, {"_id": 0})
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")
    if scope == "everyone":
        if msg["sender_id"] != user["id"]:
            raise HTTPException(status_code=403, detail="Only the sender can delete for everyone")
        await db.messages.update_one(
            {"id": msg_id},
            {"$set": {
                "deleted_for_all": True,
                "deleted_at": now_iso(),
                "text": "",
            }},
        )
    else:
        # delete for me
        hidden = list(set((msg.get("hidden_for") or []) + [user["id"]]))
        await db.messages.update_one({"id": msg_id}, {"$set": {"hidden_for": hidden}})
        # if both participants have hidden it, purge from DB to truly delete
        if set(hidden) >= set(chat["participants"]):
            await db.messages.delete_one({"id": msg_id})
    return {"ok": True, "scope": scope}


@api.post("/chats/{chat_id}/clear")
async def clear_chat(chat_id: str, user=Depends(get_user_by_token)):
    chat = await db.chats.find_one({"id": chat_id}, {"_id": 0})
    if not chat or user["id"] not in chat["participants"]:
        raise HTTPException(status_code=404, detail="Chat not found")
    cleared_at = (chat.get("cleared_at") or {})
    cleared_at[user["id"]] = now_iso()
    await db.chats.update_one(
        {"id": chat_id},
        {"$set": {"cleared_at": cleared_at, "last_message": "", "last_at": now_iso()}},
    )
    # If all participants have cleared up to "now", physically purge.
    if all(p in cleared_at for p in chat["participants"]):
        oldest_cleared = min(cleared_at[p] for p in chat["participants"])
        await db.messages.delete_many(
            {"chat_id": chat_id, "created_at": {"$lte": oldest_cleared}}
        )
    return {"ok": True, "cleared_at": cleared_at[user["id"]]}


@api.post("/chats/{chat_id}/disappearing")
async def set_disappearing(
    chat_id: str, payload: DisappearingIn, user=Depends(get_user_by_token)
):
    chat = await db.chats.find_one({"id": chat_id}, {"_id": 0})
    if not chat or user["id"] not in chat["participants"]:
        raise HTTPException(status_code=404, detail="Chat not found")
    secs = payload.seconds
    if secs is not None and (secs < 30 or secs > 60 * 60 * 24 * 365):
        raise HTTPException(status_code=400, detail="Timer must be between 30s and 1 year")
    await db.chats.update_one(
        {"id": chat_id}, {"$set": {"disappearing_seconds": secs}}
    )
    # Emit a system-style server marker as a regular message? Keep it simple — return setting.
    return {"ok": True, "disappearing_seconds": secs}


# ---------- Calls (logging only — UI is mock A/V) ----------
@api.post("/calls/initiate")
async def call_initiate(payload: CallInitiateIn, user=Depends(get_user_by_token)):
    contact = await db.contacts.find_one(
        {"id": payload.contact_id, "owner_id": user["id"]}, {"_id": 0}
    )
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    target = await db.users.find_one({"id": contact["contact_user_id"]}, {"_id": 0})
    call = {
        "id": str(uuid.uuid4()),
        "caller_id": user["id"],
        "callee_id": contact["contact_user_id"],
        "type": payload.type,
        "status": "initiated",
        "created_at": now_iso(),
    }
    await db.calls.insert_one(dict(call))
    return {
        "call_id": call["id"],
        "type": payload.type,
        "peer": {
            "id": target["id"] if target else "",
            "display_name": contact["display_name"],
            "avatar": target.get("avatar", "") if target else "",
        },
    }


@api.get("/calls")
async def list_calls(user=Depends(get_user_by_token)):
    calls = await db.calls.find(
        {"$or": [{"caller_id": user["id"]}, {"callee_id": user["id"]}]}, {"_id": 0}
    ).sort("created_at", -1).to_list(200)
    out = []
    for c in calls:
        is_outgoing = c["caller_id"] == user["id"]
        other_id = c["callee_id"] if is_outgoing else c["caller_id"]
        contact = await db.contacts.find_one(
            {"owner_id": user["id"], "contact_user_id": other_id}, {"_id": 0}
        )
        target = await db.users.find_one({"id": other_id}, {"_id": 0})
        out.append(
            {
                "id": c["id"],
                "type": c["type"],
                "direction": "outgoing" if is_outgoing else "incoming",
                "display_name": (contact or {}).get("display_name")
                or (target.get("name") if target else "Unknown"),
                "avatar": target.get("avatar", "") if target else "",
                "created_at": c["created_at"],
            }
        )
    return {"calls": out}


# ---------- Meetings ----------
@api.post("/meetings")
async def create_meeting(payload: CreateMeetingIn, user=Depends(get_user_by_token)):
    code = gen_meeting_code()
    meeting = {
        "id": str(uuid.uuid4()),
        "code": code,
        "title": payload.title.strip() or "Couling Meeting",
        "organizer_id": user["id"],
        "participants": [user["id"]],
        "muted": [],
        "all_muted": False,
        "private_talk": None,
        "status": "live",
        "created_at": now_iso(),
    }
    await db.meetings.insert_one(dict(meeting))
    return {"meeting": _meeting_view(meeting, user)}


def _meeting_view(meeting, current_user=None):
    m = {
        "id": meeting["id"],
        "code": meeting["code"],
        "title": meeting["title"],
        "organizer_id": meeting["organizer_id"],
        "participants": meeting["participants"],
        "muted": meeting.get("muted", []),
        "all_muted": meeting.get("all_muted", False),
        "private_talk": meeting.get("private_talk"),
        "status": meeting["status"],
        "created_at": meeting.get("created_at"),
    }
    if current_user is not None:
        m["is_organizer"] = meeting["organizer_id"] == current_user["id"]
    return m


@api.post("/meetings/join")
async def join_meeting(payload: JoinMeetingIn, user=Depends(get_user_by_token)):
    meeting = await db.meetings.find_one({"code": payload.code.strip().upper()}, {"_id": 0})
    if not meeting or meeting["status"] != "live":
        raise HTTPException(status_code=404, detail="Meeting not found or ended")
    if user["id"] not in meeting["participants"]:
        meeting["participants"].append(user["id"])
        await db.meetings.update_one(
            {"id": meeting["id"]}, {"$set": {"participants": meeting["participants"]}}
        )
    return {"meeting": _meeting_view(meeting, user)}


@api.get("/meetings")
async def list_meetings(user=Depends(get_user_by_token)):
    meetings = await db.meetings.find(
        {"participants": user["id"]}, {"_id": 0}
    ).sort("created_at", -1).to_list(200)
    return {"meetings": [_meeting_view(m, user) for m in meetings]}


@api.get("/meetings/{meeting_id}")
async def get_meeting(meeting_id: str, user=Depends(get_user_by_token)):
    meeting = await db.meetings.find_one({"id": meeting_id}, {"_id": 0})
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    # Resolve participant profiles (display names from organizer's contacts or own name)
    parts = []
    for pid in meeting["participants"]:
        u = await db.users.find_one({"id": pid}, {"_id": 0})
        if not u:
            continue
        contact = await db.contacts.find_one(
            {"owner_id": user["id"], "contact_user_id": pid}, {"_id": 0}
        )
        display = (
            "You"
            if pid == user["id"]
            else (contact["display_name"] if contact else u.get("name") or "Couling User")
        )
        parts.append(
            {
                "user_id": pid,
                "display_name": display,
                "avatar": u.get("avatar", ""),
                "is_organizer": pid == meeting["organizer_id"],
                "muted": pid in meeting.get("muted", []),
            }
        )
    out = _meeting_view(meeting, user)
    out["participants_detail"] = parts
    return {"meeting": out}


@api.post("/meetings/{meeting_id}/mute-all")
async def mute_all(meeting_id: str, user=Depends(get_user_by_token)):
    meeting = await db.meetings.find_one({"id": meeting_id}, {"_id": 0})
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    if meeting["organizer_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Only organizer can mute all")
    muted = [p for p in meeting["participants"] if p != user["id"]]
    await db.meetings.update_one(
        {"id": meeting_id}, {"$set": {"muted": muted, "all_muted": True}}
    )
    return {"ok": True, "muted": muted}


@api.post("/meetings/{meeting_id}/unmute-all")
async def unmute_all(meeting_id: str, user=Depends(get_user_by_token)):
    meeting = await db.meetings.find_one({"id": meeting_id}, {"_id": 0})
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    if meeting["organizer_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Only organizer can unmute all")
    await db.meetings.update_one(
        {"id": meeting_id}, {"$set": {"muted": [], "all_muted": False}}
    )
    return {"ok": True}


@api.post("/meetings/{meeting_id}/private-talk")
async def private_talk(meeting_id: str, payload: PrivateTalkIn, user=Depends(get_user_by_token)):
    meeting = await db.meetings.find_one({"id": meeting_id}, {"_id": 0})
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    if meeting["organizer_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Only organizer can start private talk")
    ids = list(set([user["id"]] + payload.participant_ids))
    invalid = [p for p in ids if p not in meeting["participants"]]
    if invalid:
        raise HTTPException(status_code=400, detail="Selected user not in meeting")
    pt = {"members": ids, "started_at": now_iso()}
    await db.meetings.update_one({"id": meeting_id}, {"$set": {"private_talk": pt}})
    return {"ok": True, "private_talk": pt}


@api.post("/meetings/{meeting_id}/private-talk/end")
async def end_private_talk(meeting_id: str, user=Depends(get_user_by_token)):
    meeting = await db.meetings.find_one({"id": meeting_id}, {"_id": 0})
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    if meeting["organizer_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Only organizer")
    await db.meetings.update_one({"id": meeting_id}, {"$set": {"private_talk": None}})
    return {"ok": True}


@api.post("/meetings/{meeting_id}/end")
async def end_meeting(meeting_id: str, user=Depends(get_user_by_token)):
    meeting = await db.meetings.find_one({"id": meeting_id}, {"_id": 0})
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    if meeting["organizer_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Only organizer can end")
    await db.meetings.update_one({"id": meeting_id}, {"$set": {"status": "ended"}})
    return {"ok": True}


@api.post("/meetings/{meeting_id}/leave")
async def leave_meeting(meeting_id: str, user=Depends(get_user_by_token)):
    meeting = await db.meetings.find_one({"id": meeting_id}, {"_id": 0})
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    parts = [p for p in meeting["participants"] if p != user["id"]]
    update = {"participants": parts}
    if meeting["organizer_id"] == user["id"]:
        update["status"] = "ended"
    await db.meetings.update_one({"id": meeting_id}, {"$set": update})
    return {"ok": True}


app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("couling")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
