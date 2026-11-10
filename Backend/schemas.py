
from datetime import date, datetime

from pydantic import BaseModel, Field, ConfigDict


class TaskCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    priority: str = "Medium"
    completed: bool = False
    due_date: date | None = None
    category: str = Field(default="Personal", max_length=30)


class TaskUpdate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    priority: str = "Medium"
    completed: bool = False
    due_date: date | None = None
    category: str | None = Field(default=None, max_length=30)


class TaskResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    priority: str
    completed: bool
    due_date: date | None = None
    category: str
    created_at: datetime
