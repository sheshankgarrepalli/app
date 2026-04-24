import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

from config import settings

SQLALCHEMY_DATABASE_URL = settings.DATABASE_URL

# Fix for SQLAlchemy 1.4+ which requires 'postgresql+psycopg2://' or similar
if SQLALCHEMY_DATABASE_URL.startswith("postgres://"):
    SQLALCHEMY_DATABASE_URL = SQLALCHEMY_DATABASE_URL.replace("postgres://", "postgresql://", 1)

print(f"DATABASE_URL protocol: {SQLALCHEMY_DATABASE_URL.split(':')[0]}")
print(f"DATABASE_URL host: {SQLALCHEMY_DATABASE_URL.split('@')[-1] if '@' in SQLALCHEMY_DATABASE_URL else 'local'}")

from sqlalchemy.pool import NullPool

if SQLALCHEMY_DATABASE_URL.startswith("sqlite"):
    engine = create_engine(
        SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
    )
else:
    # For PostgreSQL, ensure we use the right driver
    if not SQLALCHEMY_DATABASE_URL.startswith("postgresql+"):
         SQLALCHEMY_DATABASE_URL = SQLALCHEMY_DATABASE_URL.replace("postgresql://", "postgresql+psycopg2://", 1)
    
    engine = create_engine(
        SQLALCHEMY_DATABASE_URL,
        poolclass=NullPool,
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
