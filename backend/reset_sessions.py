from database import SessionLocal
from sqlalchemy import text

def reset_history():
    db = SessionLocal()
    try:
        print("Clearing all chat messages...")
        db.execute(text("DELETE FROM messages;"))
        db.commit()
        print("Chat history cleared successfully.")
    except Exception as e:
        print(f"Error clearing history: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    reset_history()
