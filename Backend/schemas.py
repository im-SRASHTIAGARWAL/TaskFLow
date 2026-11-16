
from datetime import date, datetime

from pydantic import BaseModel, Field, ConfigDict, field_validator


class TaskCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    priority: str = "Medium"
    completed: bool = False
    due_date: date | None = None
    category: str = Field(default="Personal", max_length=30)

    reminder_at: datetime | None = None
    reminder_enabled: bool = False

    @field_validator("reminder_at")
    @classmethod
    def validate_reminder_timezone(cls, value):
        if value is not None and value.tzinfo is None:
            raise ValueError("Reminder datetime must include a timezone")
        return value


class TaskUpdate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    priority: str = "Medium"
    completed: bool = False
    due_date: date | None = None
    category: str | None = Field(default=None, max_length=30)

    reminder_at: datetime | None = None
    reminder_enabled: bool = False

    @field_validator("reminder_at")
    @classmethod
    def validate_reminder_timezone(cls, value):
        if value is not None and value.tzinfo is None:
            raise ValueError("Reminder datetime must include a timezone")
        return value


class TaskResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    priority: str
    completed: bool
    due_date: date | None = None
    category: str
    created_at: datetime

    reminder_at: datetime | None = None
    reminder_enabled: bool
    reminder_sent_at: datetime | None = None


class NotificationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    task_id: int | None = None
    notification_type: str
    title: str
    message: str
    is_read: bool
    created_at: datetime


class UserPreferenceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    reminders_enabled: bool
    default_reminder_minutes: int
    browser_notifications_enabled: bool


class UserPreferenceUpdate(BaseModel):
    reminders_enabled: bool
    default_reminder_minutes: int = Field(
        ge=5,
        le=10080
    )
    browser_notifications_enabled: bool
