
import sqlite3

import pytest
from fastapi.testclient import TestClient

import Backend.main as main
from Backend.database import get_connection


@pytest.fixture
def client(tmp_path, monkeypatch):
    # Use an isolated temporary database for each test.
    test_db = tmp_path / "test_taskflow.db"

    def test_connection():
        connection = sqlite3.connect(test_db)
        connection.row_factory = sqlite3.Row
        return connection

    monkeypatch.setattr(main, "get_connection", test_connection)

    with test_connection() as connection:
        connection.execute("""
            CREATE TABLE tasks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                priority TEXT NOT NULL DEFAULT 'Medium',
                completed INTEGER NOT NULL DEFAULT 0
            )
        """)

    with TestClient(main.app) as test_client:
        yield test_client


def test_home_endpoint(client):
    response = client.get("/")
    assert response.status_code == 200
    assert response.json()["status"] == "running"


def test_get_tasks_initially_empty(client):
    response = client.get("/tasks")
    assert response.status_code == 200
    assert response.json() == []


def test_create_task(client):
    response = client.post(
        "/tasks",
        json={
            "title": "Practice DSA",
            "priority": "High",
            "completed": False,
        },
    )

    assert response.status_code == 201
    assert response.json()["title"] == "Practice DSA"
    assert response.json()["priority"] == "High"
    assert response.json()["completed"] is False
    assert "id" in response.json()


def test_update_task(client):
    created = client.post(
        "/tasks",
        json={"title": "Old title", "priority": "Low"},
    )
    task_id = created.json()["id"]

    response = client.put(
        f"/tasks/{task_id}",
        json={
            "title": "Updated title",
            "priority": "High",
            "completed": True,
        },
    )

    assert response.status_code == 200
    assert response.json()["title"] == "Updated title"
    assert response.json()["priority"] == "High"
    assert response.json()["completed"] is True


def test_delete_task(client):
    created = client.post(
        "/tasks",
        json={"title": "Delete me", "priority": "Medium"},
    )
    task_id = created.json()["id"]

    response = client.delete(f"/tasks/{task_id}")

    assert response.status_code == 200
    assert response.json()["id"] == task_id
    assert client.get("/tasks").json() == []


def test_update_missing_task_returns_404(client):
    response = client.put(
        "/tasks/999",
        json={
            "title": "Does not exist",
            "priority": "Medium",
            "completed": False,
        },
    )

    assert response.status_code == 404


def test_delete_missing_task_returns_404(client):
    response = client.delete("/tasks/999")
    assert response.status_code == 404


def test_empty_title_is_rejected(client):
    response = client.post(
        "/tasks",
        json={"title": "   ", "priority": "Medium"},
    )

    assert response.status_code == 422


def test_invalid_priority_is_rejected(client):
    response = client.post(
        "/tasks",
        json={"title": "Test task", "priority": "Urgent"},
    )

    assert response.status_code == 400
