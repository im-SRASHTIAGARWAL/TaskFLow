from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi import status
from fastapi.security import OAuth2PasswordRequestForm

from sqlalchemy.orm import Session
from sqlalchemy import text

from Backend.auth import (
    get_current_user,
    verify_password,
    create_access_token,
    hash_password
)

from Backend.database import engine, get_db, DATABASE_URL

from Backend.models import Base, Task, User

from Backend.schemas import (
    TaskCreate,
    TaskUpdate,
    TaskResponse
)

from Backend.user_schemas import (
    TokenResponse,
    UserCreate,
    UserResponse
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(
    title="TaskFlow API",
    lifespan=lifespan
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:3000",
        "http://localhost:3000",
        "http://127.0.0.1:5500",
        "http://localhost:5500",
        "http://127.0.0.1:5501",
        "http://localhost:5501",
        "https://thriving-nougat-abd826.netlify.app",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def home():
    return {
        "message": "Welcome to TaskFlow!",
        "status": "running"
    }


@app.get("/health")
def health_check(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))

        return {
            "status": "healthy",
            "database": "postgresql" if DATABASE_URL else "sqlite"
        }

    except Exception:
        raise HTTPException(
            status_code=503,
            detail="Database connection failed"
        )


# ---------------- AUTHENTICATION ----------------

@app.post(
    "/auth/register",
    status_code=201,
    response_model=UserResponse
)
def register_user(
    user: UserCreate,
    db: Session = Depends(get_db)
):
    username = user.username.strip().lower()
    email = str(user.email).strip().lower()

    existing_user = db.query(User).filter(
        (User.username == username) |
        (User.email == email)
    ).first()

    if existing_user:
        raise HTTPException(
            status_code=409,
            detail="Username or email already registered"
        )

    new_user = User(
        username=username,
        email=email,
        hashed_password=hash_password(user.password)
    )

    try:
        db.add(new_user)
        db.commit()
        db.refresh(new_user)

        return new_user

    except Exception:
        db.rollback()
        raise


@app.post("/auth/login", response_model=TokenResponse)
def login_user(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(
        User.username == form_data.username.strip().lower()
    ).first()

    if not user or not verify_password(
        form_data.password,
        user.hashed_password
    ):
        raise HTTPException(
            status_code=401,
            detail="Invalid username or password",
            headers={"WWW-Authenticate": "Bearer"}
        )

    access_token = create_access_token(
        data={"sub": str(user.id)}
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "username": user.username
    }


# ---------------- GET TASKS ----------------

@app.get("/tasks", response_model=list[TaskResponse])
def get_tasks(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return (
        db.query(Task)
        .filter(Task.owner_id == current_user.id)
        .order_by(Task.id.desc())
        .all()
    )


# ---------------- CREATE TASK ----------------

@app.post(
    "/tasks",
    status_code=201,
    response_model=TaskResponse
)
def create_task(
    task: TaskCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    title = task.title.strip()

    if not title:
        raise HTTPException(422, "Title cannot be empty")

    if task.priority not in ["Low", "Medium", "High"]:
        raise HTTPException(400, "Invalid priority")

    new_task = Task(
        title=title,
        priority=task.priority,
        completed=task.completed,
        due_date=task.due_date,
        owner_id=current_user.id
    )

    try:
        db.add(new_task)
        db.commit()
        db.refresh(new_task)

        return new_task

    except Exception:
        db.rollback()
        raise


# ---------------- UPDATE TASK ----------------

@app.put("/tasks/{task_id}", response_model=TaskResponse)
def update_task(
    task_id: int,
    updated: TaskUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    task = db.query(Task).filter(
        Task.id == task_id,
        Task.owner_id == current_user.id
    ).first()

    if task is None:
        raise HTTPException(404, "Task not found")

    title = updated.title.strip()

    if not title:
        raise HTTPException(422, "Title cannot be empty")

    if updated.priority not in ["Low", "Medium", "High"]:
        raise HTTPException(400, "Invalid priority")

    task.title = title
    task.priority = updated.priority
    task.completed = updated.completed
    task.due_date = updated.due_date

    try:
        db.commit()
        db.refresh(task)

        return task

    except Exception:
        db.rollback()
        raise


# ---------------- DELETE TASK ----------------

@app.delete("/tasks/{task_id}")
def delete_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    task = db.query(Task).filter(
        Task.id == task_id,
        Task.owner_id == current_user.id
    ).first()

    if task is None:
        raise HTTPException(404, "Task not found")

    try:
        db.delete(task)
        db.commit()

        return {
            "message": "Task deleted successfully",
            "id": task_id
        }

    except Exception:
        db.rollback()
        raise