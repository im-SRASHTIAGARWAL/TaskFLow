# TaskFlow — Task Management Web Application

TaskFlow is a full-stack task management application designed to help users organize daily tasks, manage priorities, and track their progress through a simple dashboard.

## Features

- **Create Tasks:** Add tasks with a title and priority.
- **View Tasks:** Display tasks in an organized dashboard.
- **Update Tasks:** Edit task details and mark tasks as completed.
- **Delete Tasks:** Remove tasks when they are no longer needed.
- **Filter Tasks:** View all, pending, or completed tasks.
- **Priority Management:** Assign Low, Medium, or High priority.
- **Persistent Storage:** Store tasks in an SQLite database.
- **Input Validation:** Validate task details using the backend.
- **REST API:** Handle task operations through FastAPI endpoints.
- **Automated Testing:** Test backend functionality using Pytest.

## Tech Stack

| Technology | Purpose |
|---|---|
| HTML | Application structure |
| CSS | Styling and responsive layout |
| JavaScript | Frontend interactivity and API integration |
| Python | Backend development |
| FastAPI | REST API development |
| SQLite | Database and persistent storage |
| Pytest | Automated testing |
| Git & GitHub | Version control and project hosting |

## Project Structure

```text
TaskFlow/
├── Backend/
│   ├── __init__.py
│   ├── main.py
│   └── database.py
├── Frontend/
│   ├── index.html
│   ├── style.css
│   └── script.js
├── .venv/
├── taskflow.db
├── test_main.py
├── requirements.txt
├── .gitignore
└── README.md
```

## Getting Started

### 1. Clone the Repository

```bash
git clone YOUR_GITHUB_REPOSITORY_URL
cd TaskFlow
```

Replace `YOUR_GITHUB_REPOSITORY_URL` with your actual GitHub repository URL.

### 2. Create and Activate a Virtual Environment

On Windows PowerShell:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

### 3. Install Dependencies

```bash
pip install -r requirements.txt
```

### 4. Start the Backend

Run this command from the project root:

```powershell
python -m uvicorn Backend.main:app --reload
```

The API will be available at:

`http://127.0.0.1:8000`

Explore the interactive API documentation at:

`http://127.0.0.1:8000/docs`

### 5. Launch the Frontend

Open `Frontend/index.html` using the VS Code Live Server extension.

The frontend communicates with the FastAPI backend to perform task operations.

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/` | Check the API status |
| GET | `/health` | Health check |
| GET | `/tasks` | Retrieve all tasks |
| POST | `/tasks` | Create a task |
| PUT | `/tasks/{task_id}` | Update a task |
| DELETE | `/tasks/{task_id}` | Delete a task |

## Running Tests

Run the backend test suite from the project root:

```bash
python -m pytest test_main.py -v
```

The test suite covers task creation, retrieval, updates, deletion, missing tasks, and input validation.

## Key Learnings

- Building RESTful APIs using FastAPI.
- Integrating a JavaScript frontend with a Python backend.
- Performing CRUD operations with SQLite.
- Validating user input and handling API errors.
- Writing automated backend tests with Pytest.
- Structuring a full-stack application into separate components.

## Future Improvements

- User authentication and individual task lists.
- Due dates and task reminders.
- Search and sorting functionality.
- Deployment with a hosted backend and database.
- Improved accessibility and mobile responsiveness.

## Author

**Srashti Agarwal**

Electronics and Communication Engineering Student

GitHub: [im-SRASHTIAGARWAL](https://github.com/im-SRASHTIAGARWAL)

---

*TaskFlow is a learning project developed to practice full-stack web development, API integration, database operations, and software testing.*
