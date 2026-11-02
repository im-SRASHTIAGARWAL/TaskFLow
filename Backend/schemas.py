
from pydantic import BaseModel, Field, ConfigDict


class TaskCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    priority: str = "Medium"
    completed: bool = False


class TaskUpdate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    priority: str = "Medium"
    completed: bool = False


class TaskResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    priority: str
    completed: bool
