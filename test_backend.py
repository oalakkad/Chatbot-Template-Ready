import requests
import uuid
import sys

BASE_URL = "http://127.0.0.1:8000/chat"
SESSION_ID = str(uuid.uuid4())

def send(msg, session_id=SESSION_ID):
    print(f"\nUser: {msg}")
    resp = requests.post(BASE_URL, json={"session_id": session_id, "message": msg})
    if resp.status_code != 200:
        print(f"Error: {resp.status_code} - {resp.text}")
        return None
    data = resp.json()
    print(f"AI ({data.get('state')}): {data.get('response')}")
    return data

def run_tests():
    # 1. Init
    print("--- Test 1: Init ---")
    data = send("")
    assert data["state"] == "AWAIT_PHONE", "State should be AWAIT_PHONE"

    # 2. Phone
    print("--- Test 2: Phone ---")
    data = send("1234567890")
    assert data["state"] == "AWAIT_EMAIL", "State should be AWAIT_EMAIL"

    # 3. Email
    print("--- Test 3: Email ---")
    data = send("test@company.com")
    assert data["state"] == "AWAIT_PASSWORD", "State should be AWAIT_PASSWORD"

    # 4. Password
    print("--- Test 4: Password ---")
    data = send("password123")
    assert data["state"] == "AUTHENTICATED", "State should be AUTHENTICATED"
    assert "Welcome" in data["response"], "Response should welcome user"

    # 5. Q&A
    print("--- Test 5: Q&A ---")
    data = send("What is the company policy on holidays?")
    assert "holidays" in data["response"].lower(), "Response should mention holidays"

    # 6. Takeover
    print("--- Test 6: Takeover ---")
    data = send("I want to talk to a human agent")
    assert data["state"] == "HUMAN_TAKEOVER", "State should be HUMAN_TAKEOVER"

    print("\n✅ All Backend Tests Passed!")

if __name__ == "__main__":
    try:
        run_tests()
    except AssertionError as e:
        print(f"\n❌ Test Failed: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Error: {e}")
        sys.exit(1)
