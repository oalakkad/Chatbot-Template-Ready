
from database import SessionLocal, engine
from models_db import Message, ChatSession, Document
from sqlalchemy import text
from knowledge_base import delete_document_vectors

def clear_all_data():
    db = SessionLocal()
    try:
        print("Starting data cleanup...")
        
        # 1. Clear Pinecone Vectors (for all docs in DB)
        docs = db.query(Document).all()
        for doc in docs:
            print(f"Deleting vectors for: {doc.filename}")
            try:
                delete_document_vectors(doc.filename)
            except Exception as e:
                print(f"Error deleting vectors for {doc.filename}: {e}")

        # 2. Clear SQL Tables
        print("Clearing database tables...")
        # Using truncate or delete depending on DB (MySQL supports truncate)
        db.query(Message).delete()
        db.query(ChatSession).delete()
        db.query(Document).delete()
        
        db.commit()
        print("Successfully cleared Messages, ChatSessions, and Documents.")
        
    except Exception as e:
        print(f"CRITICAL ERROR during cleanup: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    clear_all_data()
