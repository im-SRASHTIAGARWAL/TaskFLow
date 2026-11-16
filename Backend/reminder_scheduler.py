
import asyncio
import logging
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from Backend.database import SessionLocal
from Backend.models import Task, Notification, UserPreference


logger = logging.getLogger(__name__)

CHECK_INTERVAL_SECONDS = 30


def process_due_reminders(db: Session) -> int:
    """
    Find due reminders, create persistent notifications,
    and mark reminders as sent.
    """

    now = datetime.now(timezone.utc)
    created_count = 0

    due_tasks = (
        db.query(Task)
        .filter(
            Task.reminder_enabled.is_(True),
            Task.reminder_at.isnot(None),
            Task.reminder_at <= now,
            Task.reminder_sent_at.is_(None),
            Task.completed.is_(False),
            Task.owner_id.isnot(None),
        )
        .all()
    )

    for task in due_tasks:

        # Check the owner's global reminder preference.
        preference = (
            db.query(UserPreference)
            .filter(UserPreference.user_id == task.owner_id)
            .first()
        )

        # If no preference exists, reminders are enabled by default.
        if preference and not preference.reminders_enabled:
            continue

        reminder_timestamp = task.reminder_at.isoformat()

        dedupe_key = (
            f"task-reminder:{task.id}:{reminder_timestamp}"
        )

        # Prevent duplicate notifications.
        existing = (
            db.query(Notification)
            .filter(Notification.dedupe_key == dedupe_key)
            .first()
        )

        if existing:
            task.reminder_sent_at = now
            continue

        notification = Notification(
            user_id=task.owner_id,
            task_id=task.id,
            notification_type="task_reminder",
            title="Task Reminder",
            message=f"Your task '{task.title}' is due for attention.",
            is_read=False,
            dedupe_key=dedupe_key,
        )

        db.add(notification)
        task.reminder_sent_at = now
        created_count += 1

    db.commit()

    if created_count:
        logger.info(
            "Created %s task reminder notification(s).",
            created_count
        )

    return created_count


async def reminder_scheduler():
    """
    Background loop. Checks immediately on startup,
    then checks every 30 seconds.
    """

    logger.info("TaskFlow reminder scheduler started.")

    while True:
        db = SessionLocal()

        try:
            process_due_reminders(db)

        except Exception:
            db.rollback()
            logger.exception(
                "Error while processing task reminders."
            )

        finally:
            db.close()

        await asyncio.sleep(CHECK_INTERVAL_SECONDS)
