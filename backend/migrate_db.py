from database import SessionLocal
from sqlalchemy import text

def add_role_column():
    db = SessionLocal()
    try:
        # Check if column exists (simple try/catch or just run it and ignore error)
        # MySQL syntax
        print("Migrating: Adding 'role' column to 'users' table...")
        db.execute(text("ALTER TABLE users ADD COLUMN role VARCHAR(20) DEFAULT 'user';"))
        db.commit()
        print("Migration successful.")
    except Exception as e:
        print(f"Migration failed (maybe column exists?): {e}")
    finally:
        db.close()

if __name__ == "__main__":
    add_role_column()
