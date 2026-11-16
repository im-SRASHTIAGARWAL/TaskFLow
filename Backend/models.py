
from sqlalchemy import (
    Column,
    Integer,
    BigInteger,
    String,
    Boolean,
    ForeignKey,
    Date,
    DateTime,
    func
)
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)

    tasks = relationship(
        "Task",
        back_populates="owner",
        cascade="all, delete-orphan"
    )

    notifications = relationship(
        "Notification",
        back_populates="user",
        cascade="all, delete-orphan"
    )

    preferences = relationship(
        "UserPreference",
        back_populates="user",
        uselist=False,
        cascade="all, delete-orphan"
    )


class Task(Base):
    __tablename__ = "tasks"

    id = Column(
        BigInteger().with_variant(Integer, "sqlite"),
        primary_key=True,
        autoincrement=True,
        index=False
    )

    title = Column(String(200), nullable=False)

    priority = Column(String(10), default="Medium", nullable=False)

    completed = Column(Boolean, default=False, nullable=False)

    due_date = Column(Date, nullable=True)

    category = Column(
        String(30),
        default="Personal",
        server_default="Personal",
        nullable=False
    )

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )

    # Phase 2: Reminder fields
    reminder_at = Column(DateTime(timezone=True), nullable=True)

    reminder_enabled = Column(
        Boolean,
        default=False,
        server_default="false",
        nullable=False
    )

    reminder_sent_at = Column(DateTime(timezone=True), nullable=True)

    owner_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=True
    )

    owner = relationship("User", back_populates="tasks")

    notifications = relationship(
        "Notification",
        back_populates="task",
        passive_deletes=True
    )


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)

    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    task_id = Column(
        BigInteger,
        ForeignKey("tasks.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )

    notification_type = Column(String(30), nullable=False)

    title = Column(String(200), nullable=False)

    message = Column(String(500), nullable=False)

    is_read = Column(Boolean, default=False, nullable=False)

    dedupe_key = Column(String(255), unique=True, nullable=False)

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )

    user = relationship("User", back_populates="notifications")

    task = relationship("Task", back_populates="notifications")


class UserPreference(Base):
    __tablename__ = "user_preferences"

    id = Column(Integer, primary_key=True, index=True)

    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        index=True
    )

    reminders_enabled = Column(
        Boolean,
        default=True,
        server_default="true",
        nullable=False
    )

    default_reminder_minutes = Column(
        Integer,
        default=60,
        server_default="60",
        nullable=False
    )

    browser_notifications_enabled = Column(
        Boolean,
        default=False,
        server_default="false",
        nullable=False
    )

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )

    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False
    )

    user = relationship("User", back_populates="preferences")
