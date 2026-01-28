import asyncio
import sys
import os

# Add backend to path
sys.path.append(os.getcwd())

from models import ChatRequest
from agent_logic import handle_user_message, handle_user_message_stream, SESSIONS

async def test_handoff():
    session_id = "handoff_test_123"
    
    # 1. Test standard handoff (non-streaming)
    print("--- Testing Standard Handoff ---")
    req = ChatRequest(session_id=session_id, message="I want to talk to a human agent please")
    resp = await handle_user_message(req)
    print(f"Response: {resp.response}")
    print(f"State: {resp.state}")
    assert "connecting you to a human agent" in resp.response
    assert resp.state == "HUMAN_TAKEOVER"
    
    # Reset session for next test
    if session_id in SESSIONS: del SESSIONS[session_id]
    
    # 2. Test streaming handoff (the previously bugged part)
    print("\n--- Testing Streaming Handoff (Keyword Bypass Fix) ---")
    req_stream = ChatRequest(session_id=session_id, message="Can I speak with a representative?")
    
    full_resp = ""
    async for chunk in handle_user_message_stream(req_stream):
        full_resp += chunk
        
    print(f"Full Response: {full_resp}")
    print(f"Final State: {SESSIONS[session_id]['state']}")
    assert "connecting you to a human agent" in full_resp
    assert SESSIONS[session_id]['state'] == "HUMAN_TAKEOVER"

    print("\n[SUCCESS] Human handoff verified in both streaming and non-streaming modes!")

if __name__ == "__main__":
    asyncio.run(test_handoff())
