from pydantic import BaseModel
from typing import Optional

class ChatRequest(BaseModel):
    session_id: str
    message: str  # User input
    # Contextual data passed from frontend if needed (though usually state is backend-managed, 
    # for this stateless-ish API we might need to pass some identifiers or rely on session_id persistence)

from datetime import datetime

class ChatResponse(BaseModel):
    response: str # AI Message
    state: str    # Current conversation state (optional, for debug)
    action: Optional[str] = None # e.g., "takeover", "login_success"
    timestamp: Optional[datetime] = None

class VoiceResponse(BaseModel):
    transcription: str
    response_text: str
    audio_base64: Optional[str] = None
    state: str
    timestamp: Optional[datetime] = None
