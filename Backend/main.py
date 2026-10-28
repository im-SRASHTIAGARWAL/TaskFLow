
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from Backend.database import get_connection, init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(title="TaskFlow API", lifespan=lifespan)


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5500",
        "http://localhost:5500",
        "http://127.0.0.1:5501",
        "http://localhost:5501",
        "https://thriving-nougat-abd826.netlify.app",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)


class TaskCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    priority: str = "Medium"
    completed: bool = False


class TaskUpdate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    priority: str = "Medium"
    completed: bool = False


def row_to_task(row):
    return {
        "id": row["id"],
        "title": row["title"],
        "priority": row["priority"],
        "completed": bool(row["completed"]),
    }


@app.get("/")
def home():
    return {
        "message": "Welcome to TaskFlow!",
        "status": "running",
    }


@app.get("/health")
def health_check():
    return {"status": "healthy"}


@app.get("/tasks")
def get_tasks():
    with get_connection() as connection:
        rows = connection.execute(
            "SELECT * FROM tasks ORDER BY id DESC"
        ).fetchall()

        return [row_to_task(row) for row in rows]


@app.post("/tasks", status_code=201)
def create_task(task: TaskCreate):
    title = task.title.strip()

    if not title:
        raise HTTPException(
            status_code=422,
            detail="Title cannot be empty",
        )

    if task.priority not in ["Low", "Medium", "High"]:
        raise HTTPException(
            status_code=400,
            detail="Invalid priority",
        )

    with get_connection() as connection:
        cursor = connection.execute(
            """
            INSERT INTO tasks (title, priority, completed)
            VALUES (?, ?, ?)
            """,
            (title, task.priority, int(task.completed)),
        )

        row = connection.execute(
            "SELECT * FROM tasks WHERE id = ?",
            (cursor.lastrowid,),
        ).fetchone()

        return row_to_task(row)


@app.put("/tasks/{task_id}")
def update_task(task_id: int, updated: TaskUpdate):
    title = updated.title.strip()

    if not title:
        raise HTTPException(
            status_code=422,
            detail="Title cannot be empty",
        )

    if updated.priority not in ["Low", "Medium", "High"]:
        raise HTTPException(
            status_code=400,
            detail="Invalid priority",
        )

    with get_connection() as connection:
        cursor = connection.execute(
            """
            UPDATE tasks
            SET title = ?, priority = ?, completed = ?
            WHERE id = ?
            """,
            (title, updated.priority, int(updated.completed), task_id),
        )

        if cursor.rowcount == 0:
            raise HTTPException(
                status_code=404,
                detail="Task not found",
            )

        row = connection.execute(
            "SELECT * FROM tasks WHERE id = ?",
            (task_id,),
        ).fetchone()

        return row_to_task(row)


@app.delete("/tasks/{task_id}")
def delete_task(task_id: int):
    with get_connection() as connection:
        cursor = connection.execute(
            "DELETE FROM tasks WHERE id = ?",
            (task_id,),
        )

        if cursor.rowcount == 0:
            raise HTTPException(
                status_code=404,
                detail="Task not found",
            )

        return {
            "message": "Task deleted successfully",
            "id": task_id,
        }
