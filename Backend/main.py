
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from Backend.database import get_connection, init_db

USE_POSTGRES = bool(os.getenv("DATABASE_URL"))


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


def placeholder():
    return "%s" if USE_POSTGRES else "?"


def db_bool(value):
    return value if USE_POSTGRES else int(value)


@app.get("/")
def home():
    return {"message": "Welcome to TaskFlow!", "status": "running"}

@app.get("/health")
def health_check():
    from Backend.database import DATABASE_URL

    if not DATABASE_URL:
        return {
            "status": "healthy",
            "database": "sqlite"
        }

    try:
        with get_connection() as connection:
            connection.execute("SELECT 1").fetchone()

        return {
            "status": "healthy",
            "database": "postgresql"
        }
    except Exception:
        raise HTTPException(
            status_code=503,
            detail="Database connection failed"
        )

    

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
        raise HTTPException(422, "Title cannot be empty")
    if task.priority not in ["Low", "Medium", "High"]:
        raise HTTPException(400, "Invalid priority")

    p = placeholder()

    with get_connection() as connection:
        if USE_POSTGRES:
            row = connection.execute(
                f"""
                INSERT INTO tasks (title, priority, completed)
                VALUES ({p}, {p}, {p})
                RETURNING id, title, priority, completed
                """,
                (title, task.priority, db_bool(task.completed)),
            ).fetchone()
        else:
            cursor = connection.execute(
                f"""
                INSERT INTO tasks (title, priority, completed)
                VALUES ({p}, {p}, {p})
                """,
                (title, task.priority, db_bool(task.completed)),
            )
            row = connection.execute(
                f"SELECT * FROM tasks WHERE id = {p}",
                (cursor.lastrowid,),
            ).fetchone()

        return row_to_task(row)


@app.put("/tasks/{task_id}")
def update_task(task_id: int, updated: TaskUpdate):
    title = updated.title.strip()
    if not title:
        raise HTTPException(422, "Title cannot be empty")
    if updated.priority not in ["Low", "Medium", "High"]:
        raise HTTPException(400, "Invalid priority")

    p = placeholder()

    with get_connection() as connection:
        cursor = connection.execute(
            f"""
            UPDATE tasks
            SET title = {p}, priority = {p}, completed = {p}
            WHERE id = {p}
            """,
            (
                title,
                updated.priority,
                db_bool(updated.completed),
                task_id,
            ),
        )

        if cursor.rowcount == 0:
            raise HTTPException(404, "Task not found")

        row = connection.execute(
            f"SELECT * FROM tasks WHERE id = {p}",
            (task_id,),
        ).fetchone()

        return row_to_task(row)


@app.delete("/tasks/{task_id}")
def delete_task(task_id: int):
    p = placeholder()

    with get_connection() as connection:
        cursor = connection.execute(
            f"DELETE FROM tasks WHERE id = {p}",
            (task_id,),
        )

        if cursor.rowcount == 0:
            raise HTTPException(404, "Task not found")

        return {
            "message": "Task deleted successfully",
            "id": task_id,
        }
