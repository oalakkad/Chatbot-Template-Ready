from database import engine, Base
from database import engine, Base
from models_db import ChatSession, Message, Document
from sqlalchemy import text

def reset_table():
    print("Resetting Tables (ChatSession, Message, Document)...")
    with engine.connect() as conn:
        try:
            conn.execute(text("SET FOREIGN_KEY_CHECKS = 0")) # Correct MySQL syntax
            conn.execute(text("DROP TABLE IF EXISTS chat_sessions"))
            conn.execute(text("DROP TABLE IF EXISTS messages"))
            conn.execute(text("DROP TABLE IF EXISTS documents"))
            print("Dropped tables.")
            conn.commit()
        except Exception as e:
            print(f"Error dropping table: {e}")

    # Create fresh
    try:
        ChatSession.__table__.create(bind=engine)
        Message.__table__.create(bind=engine)
        Document.__table__.create(bind=engine)
        print("Tables created successfully with ALL columns.")
    except Exception as e:
        print(f"Error creating table: {e}")

if __name__ == "__main__":
    reset_table()
