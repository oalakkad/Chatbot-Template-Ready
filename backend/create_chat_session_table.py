from database import engine, Base
from models_db import ChatSession

def create_tables():
    print("Creating tables...")
    try:
        ChatSession.__table__.create(bind=engine)
        print("ChatSession table created successfully.")
    except Exception as e:
        print(f"Error (table might exist): {e}")

if __name__ == "__main__":
    create_tables()
