# pyrefly: ignore [missing-import]
from sqlalchemy import create_engine
# pyrefly: ignore [missing-import]
from sqlalchemy.ext.declarative import declarative_base
# pyrefly: ignore [missing-import]
from sqlalchemy.orm import sessionmaker
import os

SQLALCHEMY_DATABASE_URL = "sqlite:///./study_helper.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def run_migrations() -> None:
    """Apply additive schema patches to an existing database.

    `Base.metadata.create_all` creates missing tables but never adds a column to
    a table that already exists, so a new column needs an explicit ALTER.
    Idempotent: safe to call on every startup.
    """
    # pyrefly: ignore [missing-import]
    from sqlalchemy import text

    with engine.begin() as conn:
        tables = {
            row[0]
            for row in conn.execute(
                text("SELECT name FROM sqlite_master WHERE type='table'")
            )
        }
        if "study_plans" in tables:
            columns = {row[1] for row in conn.execute(text("PRAGMA table_info(study_plans)"))}
            if "user_id" not in columns:
                conn.execute(text("ALTER TABLE study_plans ADD COLUMN user_id INTEGER"))

        if "users" in tables:
            columns = {row[1] for row in conn.execute(text("PRAGMA table_info(users)"))}
            if "google_sub" not in columns:
                # SQLite cannot attach a UNIQUE constraint through ALTER TABLE,
                # so the uniqueness the model declares is enforced by this index
                # instead. SQLite treats NULLs as distinct in a unique index, so
                # every existing password-only account stays valid.
                conn.execute(text("ALTER TABLE users ADD COLUMN google_sub VARCHAR"))
                conn.execute(text(
                    "CREATE UNIQUE INDEX IF NOT EXISTS ix_users_google_sub "
                    "ON users (google_sub)"
                ))
