
import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
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
from Backend.models import (
    Base,
    Task,
    User,
    Notification,
    UserPreference
)

from Backend.schemas import (
    TaskCreate,
    TaskUpdate,
    TaskResponse,
    NotificationResponse,
    UserPreferenceResponse,
    UserPreferenceUpdate
)

from Backend.user_schemas import (
    TokenResponse,
    UserCreate,
    UserResponse
)

from Backend.reminder_scheduler import reminder_scheduler


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

VALID_PRIORITIES = ["Low", "Medium", "High"]

VALID_CATEGORIES = [
    "Study",
    "Work",
    "Personal",
    "Projects"
]


# ---------------- LIFESPAN ----------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)

    scheduler_task = asyncio.create_task(reminder_scheduler())

    logger.info("TaskFlow API started.")

    try:
        yield
    finally:
        scheduler_task.cancel()

        try:
            await scheduler_task
        except asyncio.CancelledError:
            logger.info("Reminder scheduler stopped.")

        logger.info("TaskFlow API shut down.")


app = FastAPI(
    title="TaskFlow API",
    lifespan=lifespan
)


# ---------------- CORS ----------------

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


# ---------------- HELPER FUNCTIONS ----------------

def get_or_create_preferences(
    db: Session,
    user_id: int
):
    preference = (
        db.query(UserPreference)
        .filter(UserPreference.user_id == user_id)
        .first()
    )

    if preference is None:
        preference = UserPreference(
            user_id=user_id,
            reminders_enabled=True,
            default_reminder_minutes=60,
            browser_notifications_enabled=False
        )

        db.add(preference)
        db.commit()
        db.refresh(preference)

    return preference


def validate_task_fields(task_data):
    if task_data.priority not in VALID_PRIORITIES:
        raise HTTPException(400, "Invalid priority")

    if (
        task_data.category is not None
        and task_data.category not in VALID_CATEGORIES
    ):
        raise HTTPException(400, "Invalid category")


# ---------------- HOME AND HEALTH ----------------

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

    validate_task_fields(task)

    if task.reminder_enabled and task.reminder_at is None:
        raise HTTPException(
            422,
            "A reminder date and time are required when reminders are enabled"
        )

    new_task = Task(
        title=title,
        priority=task.priority,
        completed=task.completed,
        due_date=task.due_date,
        category=task.category,
        reminder_at=task.reminder_at,
        reminder_enabled=task.reminder_enabled,
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

    validate_task_fields(updated)

    task.title = title
    task.priority = updated.priority
    task.completed = updated.completed
    task.due_date = updated.due_date

    if updated.category is not None:
        task.category = updated.category

    # Only modify reminder settings if the client supplied them.
    supplied_fields = updated.model_fields_set

    reminder_datetime_changed = False

    if "reminder_at" in supplied_fields:
        if task.reminder_at != updated.reminder_at:
            reminder_datetime_changed = True

        task.reminder_at = updated.reminder_at

    if "reminder_enabled" in supplied_fields:
        task.reminder_enabled = updated.reminder_enabled

    elif "reminder_at" in supplied_fields:
        # Supplying a non-null reminder datetime enables it by default.
        task.reminder_enabled = updated.reminder_at is not None

    if reminder_datetime_changed:
        task.reminder_sent_at = None

    if "reminder_enabled" in supplied_fields:
        if updated.reminder_enabled:
            task.reminder_sent_at = None

    if task.reminder_enabled and task.reminder_at is None:
        raise HTTPException(
            422,
            "A reminder date and time are required when reminders are enabled"
        )

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


# ==================================================
#                NOTIFICATION CENTER
# ==================================================


# ---------------- GET NOTIFICATIONS ----------------

@app.get(
    "/notifications",
    response_model=list[NotificationResponse]
)
def get_notifications(
    limit: int = Query(default=30, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return (
        db.query(Notification)
        .filter(Notification.user_id == current_user.id)
        .order_by(Notification.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )


# ---------------- UNREAD COUNT ----------------

@app.get("/notifications/unread-count")
def get_unread_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    count = (
        db.query(Notification)
        .filter(
            Notification.user_id == current_user.id,
            Notification.is_read.is_(False)
        )
        .count()
    )

    return {"unread_count": count}


# ---------------- MARK ONE AS READ ----------------

@app.patch(
    "/notifications/{notification_id}/read",
    response_model=NotificationResponse
)
def mark_notification_read(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    notification = db.query(Notification).filter(
        Notification.id == notification_id,
        Notification.user_id == current_user.id
    ).first()

    if notification is None:
        raise HTTPException(404, "Notification not found")

    notification.is_read = True

    db.commit()
    db.refresh(notification)

    return notification


# ---------------- MARK ALL AS READ ----------------

@app.patch("/notifications/read-all")
def mark_all_notifications_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    updated_count = (
        db.query(Notification)
        .filter(
            Notification.user_id == current_user.id,
            Notification.is_read.is_(False)
        )
        .update(
            {Notification.is_read: True},
            synchronize_session=False
        )
    )

    db.commit()

    return {
        "message": "All notifications marked as read",
        "updated_count": updated_count
    }


# ---------------- DELETE NOTIFICATION ----------------

@app.delete("/notifications/{notification_id}")
def delete_notification(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    notification = db.query(Notification).filter(
        Notification.id == notification_id,
        Notification.user_id == current_user.id
    ).first()

    if notification is None:
        raise HTTPException(404, "Notification not found")

    db.delete(notification)
    db.commit()

    return {
        "message": "Notification deleted successfully",
        "id": notification_id
    }


# ==================================================
#                  USER PREFERENCES
# ==================================================


# ---------------- GET PREFERENCES ----------------

@app.get(
    "/preferences",
    response_model=UserPreferenceResponse
)
def get_preferences(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    preference = get_or_create_preferences(
        db,
        current_user.id
    )

    return preference


# ---------------- UPDATE PREFERENCES ----------------

@app.put(
    "/preferences",
    response_model=UserPreferenceResponse
)
def update_preferences(
    updated: UserPreferenceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    preference = get_or_create_preferences(
        db,
        current_user.id
    )

    preference.reminders_enabled = updated.reminders_enabled

    preference.default_reminder_minutes = (
        updated.default_reminder_minutes
    )

    preference.browser_notifications_enabled = (
        updated.browser_notifications_enabled
    )

    try:
        db.commit()
        db.refresh(preference)

        return preference

    except Exception:
        db.rollback()
        raise
