from database import SessionLocal
from models_db import ChatSession, Message, User

def get_db_session():
    return SessionLocal()

def inspect_db():
    db = get_db_session()
    try:
        print("--- USERS ---")
        users = db.query(User).all()
        for u in users:
            print(f"ID: {u.id}, Name: {u.full_name}, Phone: {u.phone}")

        print("\n--- CHAT SESSIONS ---")
        sessions = db.query(ChatSession).all()
        if not sessions:
            print("No sessions found in ChatSession table.")
        for s in sessions:
            print(f"Session: {s.session_id}, UserID: {s.user_id}, Guest: {s.guest_name}, Status: {s.status}")

        print("\n--- MESSAGES (Recent 5) ---")
        msgs = db.query(Message).order_by(Message.timestamp.desc()).limit(5).all()
        for m in msgs:
            print(f"Session: {m.session_id}, Sender: {m.sender}, Content: {m.content[:20]}...")
            
    finally:
        db.close()

if __name__ == "__main__":
    inspect_db()
