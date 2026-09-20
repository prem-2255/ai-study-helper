from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean
from database import Base
import datetime

class StudyPlan(Base):
    __tablename__ = "study_plans"

    id = Column(Integer, primary_key=True, index=True)
    # Nullable: /generate-plan accepts anonymous callers, and a plan with no
    # owner is deliberately unreadable through /plans.
    user_id = Column(Integer, index=True, nullable=True)
    syllabus = Column(Text)
    days = Column(Integer)
    plan_json = Column(Text)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    email = Column(String, unique=True, index=True)
    # Nullable: accounts created through Google sign-in have no password, and
    # /auth/login treats a null hash as "this account cannot log in with a
    # password" rather than as an empty password.
    password_hash = Column(String, nullable=True)
    # Google's stable per-account identifier (the ID token's `sub` claim).
    # Stored separately from email because a Google account's email address can
    # change while its subject never does, so matching on email alone would
    # silently create a second account for the same person.
    google_sub = Column(String, unique=True, index=True, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, index=True, nullable=False)
    token = Column(String, unique=True, index=True, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    used = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


