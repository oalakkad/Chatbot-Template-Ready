from sqlalchemy.orm import Session
from sqlalchemy import desc
from models_db import User, Message
from database import SessionLocal
from datetime import datetime

def get_db_session():
    return SessionLocal()

def get_user_by_phone(phone: str):
    db: Session = get_db_session()
    try:
        return db.query(User).filter(User.phone == phone).first()
    finally:
        db.close()

def verify_password(email: str, password: str):
    db: Session = get_db_session()
    try:
        user = db.query(User).filter(User.email == email).first()
        if user:
            print(f"[DEBUG] Auth Check: '{password}' vs '{user.password}' (DB)")
            if user.password == password: 
                return True
        else:
             print(f"[DEBUG] Auth Check: User email '{email}' not found.")
        return False
    finally:
        db.close()

def create_user(phone, email, name, password, dept, role="user"):
    db: Session = get_db_session()
    try:
        new_user = User(
            phone=phone,
            email=email,
            full_name=name,
            password=password,
            department=dept,
            role=role
        )
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        return new_user
    except Exception as e:
        db.rollback()
        print(f"Error creating user: {e}")
        return None
    finally:
        db.close()

def update_user_password(phone: str, new_password: str):
    db: Session = get_db_session()
    try:
        user = db.query(User).filter(User.phone == phone).first()
        if user:
            user.password = new_password
            db.commit()
            return True
        return False
    except Exception as e:
        print(f"Error updating password: {e}")
        return False
    finally:
        db.close()

def get_all_users():
    db: Session = get_db_session()
    try:
        return db.query(User).all()
    finally:
        db.close()

from database import get_kuwait_time

def save_message(session_id: str, sender: str, content: str, read_by_user: bool = False, user_id: int = None):
    print(f"[DB_DEBUG] Saving message: Session={session_id}, Sender={sender}, Content={content[:30]}...")
    db: Session = get_db_session()
    try:
        new_msg = Message(session_id=session_id, sender=sender, content=content, timestamp=get_kuwait_time(), read_by_user=read_by_user, user_id=user_id)
        db.add(new_msg)
        db.commit()
        print(f"[DB_DEBUG] Message saved successfully to DB.")
    except Exception as e:
        print(f"Error saving message: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

def get_chat_history(session_id: str):
    db: Session = get_db_session()
    try:
        return db.query(Message).filter(Message.session_id == session_id).order_by(Message.timestamp).all()
    finally:
        db.close()

def get_unread_messages(session_id: str):
    """Get messages for USER that haven't been read yet (e.g. from Admin)."""
    db: Session = get_db_session()
    try:
        msgs = db.query(Message).filter(
            Message.session_id == session_id, 
            Message.read_by_user == False,
            Message.sender.in_(['admin', 'ai'])
        ).order_by(Message.timestamp).all()
        return msgs
    finally:
        db.close()

def mark_messages_read(session_id: str):
    db: Session = get_db_session()
    try:
        db.query(Message).filter(
            Message.session_id == session_id,
            Message.read_by_user == False
        ).update({"read_by_user": True})
        db.commit()
    finally:
        db.close()

def get_active_sessions():
    """Get list of unique session_ids from messages"""
    db: Session = get_db_session()
    try:
         # Fetch unique sessions with their latest timestamp
         sessions = db.query(Message.session_id).distinct().all()
         return [s[0] for s in sessions]
    finally:
        db.close()

from knowledge_base import search_pinecone, generate_answer_stream

async def search_knowledge_base(query: str, history: list = None, voice_mode: bool = False):
    # Backward compatibility: Join the stream into a single string
    full_answer = ""
    async for chunk in search_knowledge_base_stream(query, history, voice_mode=voice_mode):
        full_answer += chunk
    return full_answer

async def search_knowledge_base_stream(query: str, history: list = None, voice_mode: bool = False):
    # 1. Retrieve Context from Pinecone (Async & Parallel) - Now aware of history for follow-ups
    context = await search_pinecone(query, history=history)
    
    # 2. Yield chunks from the generator
    if context:
        async for chunk in generate_answer_stream(query, context, history=history, voice_mode=voice_mode):
            yield chunk
        return

    # 3. Static Fallbacks (If RAG found nothing)
    query_lower = query.lower()
    if "holiday" in query_lower:
        yield "Company holidays are listed in the HR portal. We have 12 public holidays per year."
    else:
        yield "Information not available in current records. Please verify your spelling (e.g. 'policies')."

from models_db import ChatSession
def persist_chat_session(session_id: str, user_id: int = None, guest_name: str = None, guest_dept: str = None, status: str = "ACTIVE"):
    print(f"[DB_DEBUG] Persisting Session {session_id}: User={user_id}, Name={guest_name}, Status={status}")
    db: Session = get_db_session()
    try:
        session = db.query(ChatSession).filter(ChatSession.session_id == session_id).first()
        if not session:
            print(f"[DB_DEBUG] Creating NEW ChatSession record for {session_id}")
            session = ChatSession(session_id=session_id)
            db.add(session)
        
        if user_id: session.user_id = user_id
        if guest_name: session.guest_name = guest_name
        if guest_dept: session.guest_dept = guest_dept
        if status: session.status = status
        
        db.commit()
        print(f"[DB_DEBUG] ChatSession persisted successfully.")
    except Exception as e:
        print(f"Error persisting session: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()


def is_session_ended(session_id: str):
    """Check if the last message in the session indicates it was ended."""
    db: Session = get_db_session()
    try:
        last_msg = db.query(Message).filter(Message.session_id == session_id).order_by(desc(Message.timestamp)).first()
        if last_msg and "Session ended by agent" in last_msg.content:
            return True
        return False
    finally:
        db.close()
