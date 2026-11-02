
import pytest

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

import Backend.main as main
from Backend.models import Base, User
from Backend.database import get_db
from Backend.auth import hash_password, create_access_token


@pytest.fixture
def client(tmp_path, monkeypatch):
    test_db = tmp_path / "test_taskflow.db"

    test_engine = create_engine(
        f"sqlite:///{test_db.as_posix()}",
        connect_args={"check_same_thread": False},
    )

    TestingSessionLocal = sessionmaker(
        autocommit=False,
        autoflush=False,
        bind=test_engine,
    )

    # Use temporary test database
    monkeypatch.setattr(main, "engine", test_engine)

    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    main.app.dependency_overrides[get_db] = override_get_db

    with TestClient(main.app) as test_client:

        # Create a test user
        db = TestingSessionLocal()

        test_user = User(
            username="testuser",
            email="testuser@example.com",
            hashed_password=hash_password("TestPassword123"),
        )

        db.add(test_user)
        db.commit()
        db.refresh(test_user)

        # Generate JWT token for test user
        token = create_access_token(
            {"sub": str(test_user.id)}
        )

        db.close()

        # Automatically authenticate all test requests
        test_client.headers.update({
            "Authorization": f"Bearer {token}"
        })

        yield test_client

    main.app.dependency_overrides.clear()
    test_engine.dispose()


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

def test_user_registration(client):
    response = client.post(
        "/auth/register",
        json={
            "username": "newuser",
            "email": "newuser@example.com",
            "password": "StrongPass123"
        }
    )

    assert response.status_code == 201
    assert response.json()["username"] == "newuser"
    assert response.json()["email"] == "newuser@example.com"
    assert "hashed_password" not in response.json()


def test_duplicate_user_registration(client):
    user_data = {
        "username": "duplicateuser",
        "email": "duplicate@example.com",
        "password": "StrongPass123"
    }

    first_response = client.post(
        "/auth/register",
        json=user_data
    )

    second_response = client.post(
        "/auth/register",
        json=user_data
    )

    assert first_response.status_code == 201
    assert second_response.status_code == 409


def test_user_login(client):
    response = client.post(
        "/auth/login",
        data={
            "username": "testuser",
            "password": "TestPassword123"
        }
    )

    assert response.status_code == 200
    assert "access_token" in response.json()
    assert response.json()["token_type"] == "bearer"


def test_invalid_login(client):
    response = client.post(
        "/auth/login",
        data={
            "username": "testuser",
            "password": "WrongPassword123"
        }
    )

    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid username or password"
