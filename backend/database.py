from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

import os
from dotenv import load_dotenv

load_dotenv()

# Database URL can be overridden by environment variable for Docker support
# Default: MySQL (XAMPP/Local)
mysql_url = "mysql+pymysql://root:@localhost:3306/helpdesk_ai"
DATABASE_URL = os.getenv("DATABASE_URL", mysql_url)

# SQLite database for local dev reliability
# DATABASE_URL = "sqlite:///./helpdesk.db"

engine = create_engine(
    DATABASE_URL
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

from datetime import datetime, timedelta, timezone

def get_kuwait_time():
    """Returns the current time in Kuwait (UTC+3)"""
    return datetime.now(timezone(timedelta(hours=3)))

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
