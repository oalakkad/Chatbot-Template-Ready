from database import engine, SessionLocal
from models_db import Base, User

from sqlalchemy_utils import database_exists, create_database

def init_db():
    # Create DB if not exists
    if not database_exists(engine.url):
        create_database(engine.url)
        print(f"Created database: {engine.url}")

    # Create tables
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    
    # Check if test user exists
    existing_user = db.query(User).filter(User.phone == "1234567890").first()
    if not existing_user:
        print("Seeding test user...")
        test_user = User(
            phone="1234567890",
            email="test@company.com", 
            full_name="Alice Agent", 
            password="password123",
            department="IT"
        )
        db.add(test_user)
        db.commit()
        print("Test user created.")
    else:
        print("Test user already exists.")
    
    db.close()

if __name__ == "__main__":
    init_db()
