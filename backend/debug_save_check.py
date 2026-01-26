
from database import SessionLocal
from models_db import Message, ChatSession
from datetime import datetime

def test_persistence():
    db = SessionLocal()
    session_id = "debug_test_" + datetime.now().strftime("%Y%m%d%H%M%S")
    print(f"Testing persistence for session: {session_id}")
    
    try:
        # 1. Test ChatSession
        new_session = ChatSession(session_id=session_id, guest_name="Debug User", status="ACTIVE")
        db.add(new_session)
        db.commit()
        print("ChatSession committed.")
        
        # 2. Test Message
        new_msg = Message(session_id=session_id, sender="user", content="Debug message content")
        db.add(new_msg)
        db.commit()
        print("Message committed.")
        
        # 3. Verify
        s_count = db.query(ChatSession).filter(ChatSession.session_id == session_id).count()
        m_count = db.query(Message).filter(Message.session_id == session_id).count()
        print(f"Verification: Found {s_count} sessions and {m_count} messages.")
        
    except Exception as e:
        print(f"ERROR: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    test_persistence()
