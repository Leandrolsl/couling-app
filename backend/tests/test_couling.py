"""Couling backend API tests (auth, contacts, chats, calls, meetings)."""
import os
import time
import uuid
import requests
import pytest

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://hidden-connect-12.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


def _phone(suffix: str) -> str:
    # Use unique-ish phones per run so we test the "is_new" path predictably
    return f"+1999{suffix}{int(time.time()) % 100000:05d}"


@pytest.fixture(scope="module")
def alice():
    p = _phone("100")
    s = requests.Session()
    r = s.post(f"{API}/auth/send-otp", json={"phone": p}, timeout=15)
    assert r.status_code == 200, r.text
    assert r.json().get("dev_otp") == "123456"
    r = s.post(f"{API}/auth/verify-otp", json={"phone": p, "otp": "123456"}, timeout=15)
    assert r.status_code == 200, r.text
    data = r.json()
    token = data["token"]
    user = data["user"]
    s.headers.update({"Authorization": f"Bearer {token}", "Content-Type": "application/json"})
    # set profile
    r = s.post(f"{API}/auth/profile", json={"name": "Alice", "avatar": "🦊"}, timeout=15)
    assert r.status_code == 200, r.text
    return {"session": s, "user": r.json()["user"], "phone": p, "token": token}


@pytest.fixture(scope="module")
def bob():
    p = _phone("101")
    s = requests.Session()
    r = s.post(f"{API}/auth/send-otp", json={"phone": p}, timeout=15)
    assert r.status_code == 200, r.text
    r = s.post(f"{API}/auth/verify-otp", json={"phone": p, "otp": "123456"}, timeout=15)
    assert r.status_code == 200, r.text
    data = r.json()
    token = data["token"]
    s.headers.update({"Authorization": f"Bearer {token}", "Content-Type": "application/json"})
    r = s.post(f"{API}/auth/profile", json={"name": "Bob", "avatar": "🦁"}, timeout=15)
    assert r.status_code == 200
    return {"session": s, "user": r.json()["user"], "phone": p, "token": token}


# ---------- Auth ----------
class TestAuth:
    def test_root(self):
        r = requests.get(f"{API}/", timeout=15)
        assert r.status_code == 200
        assert r.json().get("app") == "Couling"

    def test_send_otp_returns_universal_dev_otp(self):
        r = requests.post(f"{API}/auth/send-otp", json={"phone": "+15555550999"}, timeout=15)
        assert r.status_code == 200
        assert r.json()["dev_otp"] == "123456"

    def test_send_otp_rejects_short_phone(self):
        r = requests.post(f"{API}/auth/send-otp", json={"phone": "12"}, timeout=15)
        assert r.status_code == 400

    def test_verify_otp_universal_accepts_123456(self):
        p = _phone("777")
        requests.post(f"{API}/auth/send-otp", json={"phone": p}, timeout=15)
        r = requests.post(f"{API}/auth/verify-otp", json={"phone": p, "otp": "123456"}, timeout=15)
        assert r.status_code == 200
        body = r.json()
        assert body["is_new"] is True
        assert body["user"]["phone"] == p
        assert body["token"]

        # Second time should be is_new False
        r2 = requests.post(f"{API}/auth/verify-otp", json={"phone": p, "otp": "123456"}, timeout=15)
        assert r2.status_code == 200
        assert r2.json()["is_new"] is False

    def test_verify_otp_rejects_wrong(self):
        p = _phone("888")
        requests.post(f"{API}/auth/send-otp", json={"phone": p}, timeout=15)
        r = requests.post(f"{API}/auth/verify-otp", json={"phone": p, "otp": "000000"}, timeout=15)
        assert r.status_code == 400

    def test_me_requires_token(self):
        r = requests.get(f"{API}/me", timeout=15)
        assert r.status_code == 401

    def test_me_returns_user(self, alice):
        r = alice["session"].get(f"{API}/me", timeout=15)
        assert r.status_code == 200
        u = r.json()["user"]
        assert u["phone"] == alice["phone"]
        assert u["name"] == "Alice"


# ---------- Contacts ----------
class TestContacts:
    def test_add_contact_unregistered_404(self, alice):
        r = alice["session"].post(
            f"{API}/contacts/add",
            json={"phone": "+19999990000", "display_name": "Ghost"},
            timeout=15,
        )
        assert r.status_code == 404

    def test_add_contact_success_hides_phone(self, alice, bob):
        r = alice["session"].post(
            f"{API}/contacts/add",
            json={"phone": bob["phone"], "display_name": "Bobby"},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        c = r.json()["contact"]
        assert c["display_name"] == "Bobby"
        assert c["hidden_phone"] is True
        assert "phone" not in c
        # Persisted via GET
        r2 = alice["session"].get(f"{API}/contacts", timeout=15)
        assert r2.status_code == 200
        all_c = r2.json()["contacts"]
        assert any(x["id"] == c["id"] for x in all_c)
        for x in all_c:
            assert "phone" not in x
            assert x["hidden_phone"] is True

    def test_add_contact_duplicate_rejected(self, alice, bob):
        r = alice["session"].post(
            f"{API}/contacts/add",
            json={"phone": bob["phone"], "display_name": "Bobby2"},
            timeout=15,
        )
        assert r.status_code == 400


# ---------- Chats ----------
@pytest.fixture(scope="module")
def chat(alice, bob):
    # Find Bob's contact id from Alice's list
    r = alice["session"].get(f"{API}/contacts", timeout=15).json()["contacts"]
    bob_contact = next(x for x in r if x["user_id"] == bob["user"]["id"])
    r1 = alice["session"].post(
        f"{API}/chats/start", json={"contact_id": bob_contact["id"]}, timeout=15
    )
    assert r1.status_code == 200
    chat_id = r1.json()["chat_id"]
    # idempotent
    r2 = alice["session"].post(
        f"{API}/chats/start", json={"contact_id": bob_contact["id"]}, timeout=15
    )
    assert r2.status_code == 200
    assert r2.json()["chat_id"] == chat_id
    return chat_id


class TestChats:
    def test_send_and_get_messages(self, alice, chat):
        msg_text = f"hello bob {uuid.uuid4().hex[:6]}"
        r = alice["session"].post(
            f"{API}/chats/{chat}/messages", json={"text": msg_text}, timeout=15
        )
        assert r.status_code == 200
        assert r.json()["message"]["text"] == msg_text

        r2 = alice["session"].get(f"{API}/chats/{chat}/messages", timeout=15)
        assert r2.status_code == 200
        msgs = r2.json()["messages"]
        assert any(m["text"] == msg_text for m in msgs)
        # ordered by created_at ascending
        if len(msgs) >= 2:
            ts = [m["created_at"] for m in msgs]
            assert ts == sorted(ts)


# ---------- Calls ----------
class TestCalls:
    def test_initiate_and_list(self, alice, bob):
        contacts = alice["session"].get(f"{API}/contacts", timeout=15).json()["contacts"]
        bob_contact = next(x for x in contacts if x["user_id"] == bob["user"]["id"])
        r = alice["session"].post(
            f"{API}/calls/initiate",
            json={"contact_id": bob_contact["id"], "type": "video"},
            timeout=15,
        )
        assert r.status_code == 200
        call = r.json()
        assert call["type"] == "video"
        assert call["peer"]["display_name"] == "Bobby"
        # No phone leak
        assert "phone" not in call["peer"]

        r2 = alice["session"].get(f"{API}/calls", timeout=15)
        assert r2.status_code == 200
        calls = r2.json()["calls"]
        assert any(c["id"] == call["call_id"] for c in calls)


# ---------- Meetings ----------
@pytest.fixture(scope="module")
def meeting(alice):
    r = alice["session"].post(f"{API}/meetings", json={"title": "Strategy"}, timeout=15)
    assert r.status_code == 200
    return r.json()["meeting"]


class TestMeetings:
    def test_create_has_code_and_organizer(self, alice, meeting):
        # code format ABC-XYZ-123
        parts = meeting["code"].split("-")
        assert len(parts) == 3 and all(len(p) == 3 for p in parts)
        assert meeting["organizer_id"] == alice["user"]["id"]
        assert meeting["is_organizer"] is True

    def test_get_meeting_no_phones_in_participants(self, alice, meeting):
        r = alice["session"].get(f"{API}/meetings/{meeting['id']}", timeout=15)
        assert r.status_code == 200
        m = r.json()["meeting"]
        for p in m["participants_detail"]:
            assert "phone" not in p
            assert "display_name" in p

    def test_join_meeting_adds_bob(self, bob, meeting):
        r = bob["session"].post(
            f"{API}/meetings/join", json={"code": meeting["code"]}, timeout=15
        )
        assert r.status_code == 200
        m = r.json()["meeting"]
        assert bob["user"]["id"] in m["participants"]
        assert m["is_organizer"] is False

    def test_non_organizer_cannot_mute_all(self, bob, meeting):
        r = bob["session"].post(f"{API}/meetings/{meeting['id']}/mute-all", timeout=15)
        assert r.status_code == 403

    def test_organizer_mute_all(self, alice, bob, meeting):
        r = alice["session"].post(f"{API}/meetings/{meeting['id']}/mute-all", timeout=15)
        assert r.status_code == 200
        assert bob["user"]["id"] in r.json()["muted"]
        # verify via GET
        m = alice["session"].get(f"{API}/meetings/{meeting['id']}", timeout=15).json()["meeting"]
        assert m["all_muted"] is True

    def test_non_organizer_cannot_private_talk(self, bob, meeting):
        r = bob["session"].post(
            f"{API}/meetings/{meeting['id']}/private-talk",
            json={"participant_ids": [bob["user"]["id"]]},
            timeout=15,
        )
        assert r.status_code == 403

    def test_organizer_private_talk(self, alice, bob, meeting):
        r = alice["session"].post(
            f"{API}/meetings/{meeting['id']}/private-talk",
            json={"participant_ids": [bob["user"]["id"]]},
            timeout=15,
        )
        assert r.status_code == 200
        pt = r.json()["private_talk"]
        assert alice["user"]["id"] in pt["members"]
        assert bob["user"]["id"] in pt["members"]

    def test_non_organizer_cannot_end(self, bob, meeting):
        r = bob["session"].post(f"{API}/meetings/{meeting['id']}/end", timeout=15)
        assert r.status_code == 403

    def test_organizer_end(self, alice, meeting):
        r = alice["session"].post(f"{API}/meetings/{meeting['id']}/end", timeout=15)
        assert r.status_code == 200
