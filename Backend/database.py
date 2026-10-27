
import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent.parent / "taskflow.db"


def get_connection():
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    return connection


def init_db():
    with get_connection() as connection:
        connection.execute("""
            CREATE TABLE IF NOT EXISTS tasks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                priority TEXT NOT NULL DEFAULT 'Medium',
                completed INTEGER NOT NULL DEFAULT 0
            )
        """)

        count = connection.execute(
            "SELECT COUNT(*) FROM tasks"
        ).fetchone()[0]

        if count == 0:
            connection.executemany(
                """
                INSERT INTO tasks (title, priority, completed)
                VALUES (?, ?, ?)
                """,
                [
                    ("Complete DSA practice", "High", 0),
                    ("Revise SQL queries", "Medium", 0),
                    ("Review project README", "Low", 1),
                ],
            )
