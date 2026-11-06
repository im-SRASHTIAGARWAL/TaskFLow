from sqlalchemy import (
    Column, Integer, BigInteger, String,
    Boolean, ForeignKey, Date
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

    owner_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    owner = relationship("User", back_populates="tasks")