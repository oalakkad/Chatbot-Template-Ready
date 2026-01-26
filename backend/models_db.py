from sqlalchemy import Column, Integer, String, Boolean, Text, DateTime, ForeignKey
from database import Base, get_kuwait_time
from datetime import datetime

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    phone = Column(String(50), unique=True, index=True)
    email = Column(String(100), unique=True, index=True)
    full_name = Column(String(100))
    password = Column(String(255)) # In real app, hash this!
    department = Column(String(50))
    role = Column(String(20), default="user") # 'admin', 'agent', 'user'

class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String(100), index=True)
    sender = Column(String(20)) # 'user', 'ai', 'admin'
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True) # Direct link
    content = Column(Text)
    timestamp = Column(DateTime, default=get_kuwait_time)
    read_by_user = Column(Boolean, default=False)

class Document(Base):
    __tablename__ = "documents"
    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String(255))
    upload_date = Column(DateTime, default=get_kuwait_time)
    status = Column(String(50)) # 'INDEXING', 'READY', 'ERROR'
    chunk_count = Column(Integer, default=0)

class ChatSession(Base):
    __tablename__ = "chat_sessions"

    session_id = Column(String(100), primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    guest_name = Column(String(100), nullable=True)
    guest_dept = Column(String(100), nullable=True)
    status = Column(String(20), default="ACTIVE") # ACTIVE, ENDED
    created_at = Column(DateTime, default=get_kuwait_time)
