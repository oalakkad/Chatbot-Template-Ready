from fastapi import FastAPI, HTTPException, Body, UploadFile, File, Depends, Header, Form
from fastapi.middleware.cors import CORSMiddleware
from agent_logic import handle_user_message, get_all_sessions, end_session
from models import ChatRequest, ChatResponse
from utils import get_all_users, save_message, get_chat_history, get_unread_messages, mark_messages_read, get_active_sessions, create_user, is_session_ended, get_db_session
from pydantic import BaseModel
from typing import List, Optional
from database import engine, get_db
import models_db
from sqlalchemy.orm import Session
from knowledge_base import ingest_pdf
from voice_utils import transcribe_audio, generate_speech
import base64
import io
import models

app = FastAPI(title="Help Desk AI Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class AdminMessage(BaseModel):
    session_id: str
    message: str
    agent_name: str = "Support Agent"

class AdminLogin(BaseModel):
    email: str
    password: str

class UserCreate(BaseModel):
    phone: str
    email: str
    full_name: str
    password: str
    department: str
    role: str = "user"

@app.get("/")
def read_root():
    return {"status": "ok", "service": "Help Desk AI Backend"}

@app.post("/chat", response_model=ChatResponse)
async def chat_endpoint(request: ChatRequest):
    try:
        response_data = await handle_user_message(request)
        return response_data
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/chat/voice", response_model=models.VoiceResponse)
async def chat_voice_endpoint(
    session_id: str = Form(...),
    audio: UploadFile = File(...)
):
    try:
        # 1. Transcribe
        audio_content = await audio.read()
        audio_stream = io.BytesIO(audio_content)
        transcription = await transcribe_audio(audio_stream)
        
        if not transcription:
             raise HTTPException(status_code=400, detail="Could not transcribe audio")
             
        # 2. Get AI Response text using the existing handle_user_message logic
        chat_req = ChatRequest(session_id=session_id, message=transcription)
        ai_resp = await handle_user_message(chat_req)
        
        # 3. Generate TTS for AI Response
        voice_data = await generate_speech(ai_resp.response)
        voice_b64 = base64.b64encode(voice_data).decode("utf-8") if voice_data else None
        
        from database import get_kuwait_time
        return models.VoiceResponse(
            transcription=transcription,
            response_text=ai_resp.response,
            audio_base64=voice_b64,
            state=ai_resp.state,
            timestamp=get_kuwait_time()
        )
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/chat/poll")
def poll_updates(session_id: str = Body(..., embed=True)):
    """Frontend polls this to get messages from Admin or AI that were pushed async."""
    messages = get_unread_messages(session_id)
    
    # Check if admin is active in this session
    sessions = get_all_sessions()
    is_active_agent = False
    session_ended = False

    if session_id in sessions:
        session_data = sessions[session_id]
        if session_data.get("state") == "HUMAN_TAKEOVER":
            is_active_agent = True
        elif session_data.get("state") == "ENDED":
            session_ended = True
            
    # Fallback: Check DB if not currently known as ended in memory (e.g. after restart)
    if not session_ended and is_session_ended(session_id):
        session_ended = True

    
    agent_name = None
    if is_active_agent and session_id in sessions:
        agent_name = sessions[session_id]["data"].get("agent_name")

    if messages:
        mark_messages_read(session_id)
        return {
            "has_new": True, 
            "messages": [{"text": m.content, "sender": m.sender, "timestamp": m.timestamp} for m in messages],
            "active_agent": is_active_agent,
            "agent_name": agent_name,
            "session_ended": session_ended
        }
    return {"has_new": False, "messages": [], "active_agent": is_active_agent, "agent_name": agent_name, "session_ended": session_ended}

@app.post("/chat/end")
def end_user_session(session_id: str = Body(..., embed=True)):
    """User manually ends their session"""
    from agent_logic import end_session as logic_end_session
    logic_end_session(session_id)
    # Save system message
    save_message(session_id, "ai", "Session ended by user.", read_by_user=True)
    return {"status": "ended", "session_id": session_id}

@app.get("/users")
def get_users():
    users = get_all_users()
    return users

# --- ADMIN ENDPOINTS ---

@app.post("/admin/login")
def admin_login(creds: AdminLogin, db: Session = Depends(get_db)):
    from models_db import User
    user = db.query(User).filter(User.email == creds.email).first()
    if user and user.password == creds.password and user.role in ["admin", "agent"]:
        return {
            "status": "success", 
            "token": f"token-{user.role}-{user.id}",
            "user": {"name": user.full_name, "role": user.role}
        }
    raise HTTPException(status_code=401, detail="Invalid credentials or access denied")

@app.get("/admin/me")
def get_admin_me(db: Session = Depends(get_db), authorization: str = Header(None)):
    """Recovers user info from the session token."""
    if not authorization or not authorization.startswith("token-"):
         raise HTTPException(status_code=401, detail="Invalid token")
    
    parts = authorization.split("-")
    if len(parts) < 3:
         raise HTTPException(status_code=401, detail="Malformed token")
    
    try:
        user_id = int(parts[2])
        from models_db import User
        user = db.query(User).filter(User.id == user_id).first()
        if user:
            return {"name": user.full_name, "role": user.role}
    except:
        pass
        
    raise HTTPException(status_code=401, detail="User not found")

@app.get("/admin/sessions")
def get_sessions(db: Session = Depends(get_db)):
    """Get all chat sessions with metadata efficiently via SQL JOIN."""
    # 1. Get unique session IDs from Messages
    # 2. Join with ChatSession and User for metadata
    # This replaces the slow N+1 Python loop
    
    from sqlalchemy import func
    from models_db import Message, ChatSession, User
    
    # Subquery to get unique session IDs and their latest message timestamp
    latest_msg_sub = db.query(
        Message.session_id,
        func.max(Message.timestamp).label("last_activity")
    ).group_by(Message.session_id).subquery()
    
    # Query all unique sessions joined with metadata
    query = db.query(
        latest_msg_sub.c.session_id,
        latest_msg_sub.c.last_activity,
        ChatSession.status,
        ChatSession.guest_name,
        ChatSession.guest_dept,
        User.full_name.label("user_name"),
        User.department.label("user_dept")
    ).outerjoin(ChatSession, latest_msg_sub.c.session_id == ChatSession.session_id)\
     .outerjoin(User, ChatSession.user_id == User.id)\
     .order_by(latest_msg_sub.c.last_activity.desc())

    db_results = query.all()
    
    # 3. Incorporate Live/In-Memory States
    live_sessions = get_all_sessions()
    results = []
    seen_ids = set()

    # First, handle currently active/live sessions
    for sid, data in live_sessions.items():
        state = data.get("state", "UNKNOWN")
        if state == "ENDED": continue
        
        status = "NEEDS_ATTENTION" if state == "HUMAN_TAKEOVER" else "ACTIVE"
        session_data = data.get("data", {})
        user_obj = session_data.get("user", {})
        
        name = user_obj.get("name") or session_data.get("reg_name") or "Guest User"
        dept = user_obj.get("department") or session_data.get("reg_dept") or "General"
        
        results.append({
            "session_id": sid,
            "status": status,
            "user_name": name,
            "user_dept": dept
        })
        seen_ids.add(sid)

    # Second, add historical sessions from DB
    for row in db_results:
        if row.session_id in seen_ids: continue
        
        # Determine status: check if "Session ended by agent" exists in last message? 
        # (Simplified: use ChatSession status or default to IDLE)
        status = row.status or "IDLE"
        
        results.append({
            "session_id": row.session_id,
            "status": status,
            "user_name": row.user_name or row.guest_name or "Guest User",
            "user_dept": row.user_dept or row.guest_dept or "Unknown"
        })
        seen_ids.add(row.session_id)

    print(f"[DEBUG] get_sessions: Total_Results={len(results)}")
    return results

@app.post("/admin/knowledge/upload")
async def upload_pdf(file: UploadFile = File(...), db: Session = Depends(get_db)):
    """Uploads a PDF to the vector database"""
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")
    
    try:
        chunks = ingest_pdf(file, db)
        return {"status": "success", "filename": file.filename, "chunks": chunks}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/admin/knowledge/files")
def list_documents(db: Session = Depends(get_db)):
    """List all indexed documents"""
    docs = db.query(models_db.Document).order_by(models_db.Document.upload_date.desc()).all()
    print(f"[DEBUG] Listing Documents: found {len(docs)}")
    return docs

from knowledge_base import delete_document_vectors

@app.delete("/admin/knowledge/delete/{doc_id}")
def delete_document_endpoint(doc_id: int, db: Session = Depends(get_db)):
    """Deletes a document from DB and Pinecone"""
    doc = db.query(models_db.Document).filter(models_db.Document.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    
    try:
        # 1. Delete from Pinecone
        delete_document_vectors(doc.filename)
        
        # 2. Delete from DB
        db.delete(doc)
        db.commit()
        return {"status": "success", "message": f"Deleted {doc.filename}"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/admin/chat/{session_id}")
def get_chat(session_id: str):
    """Get history for a specific session"""
    history = get_chat_history(session_id)
    return [{"sender": m.sender, "text": m.content, "timestamp": m.timestamp} for m in history]

@app.post("/admin/reply")
def admin_reply(req: AdminMessage):
    """Admin sends a message to a user"""
    # Store agent name in session for the frontend
    sessions = get_all_sessions()
    if req.session_id in sessions:
        sessions[req.session_id]["data"]["agent_name"] = req.agent_name
        # Force state to HUMAN_TAKEOVER so frontend shows the agent UI
        sessions[req.session_id]["state"] = "HUMAN_TAKEOVER"
        
    save_message(req.session_id, "admin", req.message)
    return {"status": "sent"}

@app.post("/admin/session/end")
def api_end_session(req: AdminMessage):
    """Admin ends a session"""
    if end_session(req.session_id):
        save_message(req.session_id, "admin", "Session ended by agent.")
        return {"status": "ended"}
    raise HTTPException(status_code=404, detail="Session not found")

@app.post("/admin/users")
def api_create_user(user: UserCreate):
    new_user = create_user(
        phone=user.phone,
        email=user.email,
        name=user.full_name,
        password=user.password,
        dept=user.department,
        role=user.role
    )
    if new_user:
        return {"status": "created", "id": new_user.id}
    raise HTTPException(status_code=400, detail="User already exists or error creating")

@app.delete("/admin/users/{user_id}")
def delete_user_endpoint(user_id: int, db: Session = Depends(get_db)):
    """Deletes a user from the database, handling linked data."""
    from models_db import User, Message, ChatSession
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    try:
        # 1. Nullify user_id in related messages and sessions to avoid FK errors
        # (This is safer than cascading delete if we want to keep chat history)
        db.query(Message).filter(Message.user_id == user_id).update({Message.user_id: None})
        db.query(ChatSession).filter(ChatSession.user_id == user_id).update({ChatSession.user_id: None})
        
        # 2. Delete the user
        db.delete(user)
        db.commit()
        print(f"[ADMIN] User {user_id} ({user.full_name}) deleted successfully.")
        return {"status": "success", "message": f"User {user.full_name} deleted"}
    except Exception as e:
        db.rollback()
        print(f"[ERROR] Failed to delete user {user_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
