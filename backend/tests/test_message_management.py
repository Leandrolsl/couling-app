"""Couling — iteration 2 backend tests for message management features.

Covers:
- DELETE /api/chats/{chat_id}/messages/{msg_id}?scope=me|everyone
- POST   /api/chats/{chat_id}/clear
- POST   /api/chats/{chat_id}/disappearing
- GET    /api/chats/{chat_id}/messages — visibility filters & purge
"""
import os
import time
import uuid
import requests
import pytest

BASE_URL = os.environ.get(
    "EXPO_PUBLIC_BACKEND_URL",
    "https://hidden-connect-12.preview.emergentagent.com",
).rstrip("/")
API = f"{BASE_URL}/api"


def _phone(suffix: str) -> str:
    # uniqueness per run
    return f"+1888{suffix}{int(time.time()) % 100000:05d}{uuid.uuid4().hex[:2]}"


def _signup(name: str, avatar: str, suffix: str):
    p = _phone(suffix)
    s = requests.Session()
    r = s.post(f"{API}/auth/send-otp", json={"phone": p}, timeout=15)
    assert r.status_code == 200, r.text
    r = s.post(f"{API}/auth/verify-otp", json={"phone": p, "otp": "123456"}, timeout=15)
    assert r.status_code == 200, r.text
    token = r.json()["token"]
    s.headers.update({"Authorization": f"Bearer {token}", "Content-Type": "application/json"})
    r = s.post(f"{API}/auth/profile", json={"name": name, "avatar": avatar}, timeout=15)
    assert r.status_code == 200, r.text
    return {"session": s, "user": r.json()["user"], "phone": p, "token": token}


@pytest.fixture(scope="module")
def pair():
    """Alice & Bob signed up + connected + chat opened."""
    alice = _signup("AliceMM", "🦊", "200")
    bob = _signup("BobMM", "🐺", "201")

    # Alice adds Bob; Bob also adds Alice so both can chat from either side
    r = alice["session"].post(
        f"{API}/contacts/add",
        json={"phone": bob["phone"], "display_name": "Bobby"},
        timeout=15,
    )
    assert r.status_code == 200, r.text
    alice_contact_for_bob = r.json()["contact"]

    r = bob["session"].post(
        f"{API}/contacts/add",
        json={"phone": alice["phone"], "display_name": "Ally"},
        timeout=15,
    )
    assert r.status_code == 200, r.text

    r = alice["session"].post(
        f"{API}/chats/start", json={"contact_id": alice_contact_for_bob["id"]}, timeout=15
    )
    assert r.status_code == 200
    chat_id = r.json()["chat_id"]
    return {"alice": alice, "bob": bob, "chat_id": chat_id}


def _send(s, chat_id, text):
    r = s.post(f"{API}/chats/{chat_id}/messages", json={"text": text}, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["message"]


def _get_msgs(s, chat_id):
    r = s.get(f"{API}/chats/{chat_id}/messages", timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["messages"]


# ---------- Delete for me ----------
class TestDeleteForMe:
    def test_delete_for_me_hides_only_for_caller(self, pair):
        chat_id = pair["chat_id"]
        msg = _send(pair["alice"]["session"], chat_id, f"hello-me-{uuid.uuid4().hex[:6]}")

        # Alice deletes for herself
        r = pair["alice"]["session"].delete(
            f"{API}/chats/{chat_id}/messages/{msg['id']}?scope=me", timeout=15
        )
        assert r.status_code == 200, r.text
        assert r.json()["scope"] == "me"

        # Alice no longer sees it
        a_msgs = _get_msgs(pair["alice"]["session"], chat_id)
        assert not any(m["id"] == msg["id"] for m in a_msgs)

        # Bob still sees it
        b_msgs = _get_msgs(pair["bob"]["session"], chat_id)
        assert any(m["id"] == msg["id"] and m["text"] == msg["text"] for m in b_msgs)

    def test_delete_for_me_by_both_physically_purges(self, pair):
        chat_id = pair["chat_id"]
        msg = _send(pair["bob"]["session"], chat_id, f"purge-me-{uuid.uuid4().hex[:6]}")

        # Both hide it
        r1 = pair["alice"]["session"].delete(
            f"{API}/chats/{chat_id}/messages/{msg['id']}?scope=me", timeout=15
        )
        assert r1.status_code == 200
        r2 = pair["bob"]["session"].delete(
            f"{API}/chats/{chat_id}/messages/{msg['id']}?scope=me", timeout=15
        )
        assert r2.status_code == 200

        # Now it's physically gone — a subsequent delete should 404
        r3 = pair["alice"]["session"].delete(
            f"{API}/chats/{chat_id}/messages/{msg['id']}?scope=me", timeout=15
        )
        assert r3.status_code == 404


# ---------- Delete for everyone ----------
class TestDeleteForEveryone:
    def test_only_sender_can_delete_for_everyone(self, pair):
        chat_id = pair["chat_id"]
        msg = _send(pair["alice"]["session"], chat_id, f"alice-says-{uuid.uuid4().hex[:6]}")

        # Bob (non-sender) attempts — 403
        r = pair["bob"]["session"].delete(
            f"{API}/chats/{chat_id}/messages/{msg['id']}?scope=everyone", timeout=15
        )
        assert r.status_code == 403

    def test_delete_for_everyone_keeps_tombstone(self, pair):
        chat_id = pair["chat_id"]
        original = f"alice-tombstone-{uuid.uuid4().hex[:6]}"
        msg = _send(pair["alice"]["session"], chat_id, original)

        r = pair["alice"]["session"].delete(
            f"{API}/chats/{chat_id}/messages/{msg['id']}?scope=everyone", timeout=15
        )
        assert r.status_code == 200, r.text
        assert r.json()["scope"] == "everyone"

        # Both still see a tombstone with deleted_for_all=true, empty text
        for s in (pair["alice"]["session"], pair["bob"]["session"]):
            msgs = _get_msgs(s, chat_id)
            found = next((m for m in msgs if m["id"] == msg["id"]), None)
            assert found is not None, "tombstone should remain in GET response"
            assert found["deleted_for_all"] is True
            assert found["text"] == ""
            assert found.get("deleted_at")


# ---------- Clear conversation ----------
class TestClearConversation:
    def test_clear_hides_for_caller_not_other(self, pair):
        chat_id = pair["chat_id"]
        # Send a couple of messages so there's something to clear
        m1 = _send(pair["alice"]["session"], chat_id, f"pre-clear-A-{uuid.uuid4().hex[:6]}")
        m2 = _send(pair["bob"]["session"], chat_id, f"pre-clear-B-{uuid.uuid4().hex[:6]}")
        # ensure cleared_at strictly greater than the messages we just sent
        time.sleep(1.2)

        r = pair["alice"]["session"].post(f"{API}/chats/{chat_id}/clear", timeout=15)
        assert r.status_code == 200, r.text
        assert "cleared_at" in r.json()

        # Alice sees no messages now
        a_msgs = _get_msgs(pair["alice"]["session"], chat_id)
        assert len(a_msgs) == 0, f"Alice should see 0 after clear, got {len(a_msgs)}"

        # Bob still sees the messages
        b_msgs = _get_msgs(pair["bob"]["session"], chat_id)
        ids = {m["id"] for m in b_msgs}
        assert m1["id"] in ids
        assert m2["id"] in ids


# ---------- Disappearing messages ----------
class TestDisappearing:
    def test_set_disappearing_valid_24h(self, pair):
        r = pair["alice"]["session"].post(
            f"{API}/chats/{pair['chat_id']}/disappearing",
            json={"seconds": 86400},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        assert r.json()["disappearing_seconds"] == 86400

        # Verify persisted via list_chats
        chats = pair["alice"]["session"].get(f"{API}/chats", timeout=15).json()["chats"]
        this_chat = next(c for c in chats if c["id"] == pair["chat_id"])
        assert this_chat["disappearing_seconds"] == 86400

    def test_set_disappearing_null_turns_off(self, pair):
        r = pair["alice"]["session"].post(
            f"{API}/chats/{pair['chat_id']}/disappearing",
            json={"seconds": None},
            timeout=15,
        )
        assert r.status_code == 200
        assert r.json()["disappearing_seconds"] is None

    def test_set_disappearing_rejects_under_30s(self, pair):
        r = pair["alice"]["session"].post(
            f"{API}/chats/{pair['chat_id']}/disappearing",
            json={"seconds": 10},
            timeout=15,
        )
        assert r.status_code == 400

    def test_set_disappearing_rejects_over_one_year(self, pair):
        r = pair["alice"]["session"].post(
            f"{API}/chats/{pair['chat_id']}/disappearing",
            json={"seconds": 60 * 60 * 24 * 366},
            timeout=15,
        )
        assert r.status_code == 400

    def test_auto_purge_on_fetch(self, pair):
        """Set a 30s TTL, send a message, force-age it in DB, then GET should purge."""
        chat_id = pair["chat_id"]

        # Enable 30s disappearing
        r = pair["alice"]["session"].post(
            f"{API}/chats/{chat_id}/disappearing", json={"seconds": 30}, timeout=15
        )
        assert r.status_code == 200

        # Send a message
        msg = _send(pair["alice"]["session"], chat_id, f"vanish-{uuid.uuid4().hex[:6]}")

        # Force-age via Mongo: rewrite created_at to far past.
        # We don't have a direct DB handle here, but we can simulate by sleeping
        # if 30s is acceptable. We use the existing client via motor through a
        # tiny helper: skip if no MONGO_URL available.
        mongo_url = os.environ.get("MONGO_URL")
        if not mongo_url:
            pytest.skip("MONGO_URL not exposed to test runner; skipping forced-age purge test.")

        import asyncio
        from motor.motor_asyncio import AsyncIOMotorClient

        db_name = os.environ.get("DB_NAME", "test_database")

        async def age_and_check():
            cli = AsyncIOMotorClient(mongo_url)
            try:
                db = cli[db_name]
                from datetime import datetime, timezone, timedelta
                old_ts = (datetime.now(timezone.utc) - timedelta(seconds=120)).isoformat()
                res = await db.messages.update_one(
                    {"id": msg["id"]}, {"$set": {"created_at": old_ts}}
                )
                assert res.matched_count == 1
            finally:
                cli.close()

        asyncio.get_event_loop().run_until_complete(age_and_check())

        # GET should trigger _purge_expired and physically remove the aged msg
        a_msgs = _get_msgs(pair["alice"]["session"], chat_id)
        assert not any(m["id"] == msg["id"] for m in a_msgs)
        b_msgs = _get_msgs(pair["bob"]["session"], chat_id)
        assert not any(m["id"] == msg["id"] for m in b_msgs)

        # Turn off disappearing to not affect subsequent tests
        pair["alice"]["session"].post(
            f"{API}/chats/{chat_id}/disappearing", json={"seconds": None}, timeout=15
        )


# ---------- Edge cases ----------
class TestEdgeCases:
    def test_delete_nonexistent_message_404(self, pair):
        r = pair["alice"]["session"].delete(
            f"{API}/chats/{pair['chat_id']}/messages/nope-{uuid.uuid4().hex}?scope=me",
            timeout=15,
        )
        assert r.status_code == 404

    def test_non_participant_cannot_delete(self, pair):
        # Third user
        carol = _signup("Carol", "🦝", "202")
        r = carol["session"].delete(
            f"{API}/chats/{pair['chat_id']}/messages/anything?scope=me", timeout=15
        )
        assert r.status_code == 404

    def test_non_participant_cannot_clear(self, pair):
        carol = _signup("Carol2", "🦝", "203")
        r = carol["session"].post(f"{API}/chats/{pair['chat_id']}/clear", timeout=15)
        assert r.status_code == 404

    def test_non_participant_cannot_set_disappearing(self, pair):
        carol = _signup("Carol3", "🦝", "204")
        r = carol["session"].post(
            f"{API}/chats/{pair['chat_id']}/disappearing",
            json={"seconds": 86400},
            timeout=15,
        )
        assert r.status_code == 404
