
const API_URL = "https://taskflow-api-wbfe.onrender.com/tasks";
const AUTH_URL = "https://taskflow-api-wbfe.onrender.com/auth";

let authMode = "login";
let authToken = localStorage.getItem("taskflow_token");
let currentUsername = localStorage.getItem("taskflow_username") || "";

let tasks = [];
let currentFilter = "all";
let currentSearch = "";
let currentPriority = "all";
let editingTask = null;

// User elements
const userAvatar = document.getElementById("userAvatar");
const displayUsername = document.getElementById("displayUsername");

// Authentication elements
const authSection = document.getElementById("authSection");
const dashboard = document.getElementById("dashboard");
const authForm = document.getElementById("authForm");
const authUsername = document.getElementById("authUsername");
const authEmail = document.getElementById("authEmail");
const authPassword = document.getElementById("authPassword");
const authTitle = document.getElementById("authTitle");
const authSubtitle = document.getElementById("authSubtitle");
const authSubmitBtn = document.getElementById("authSubmitBtn");
const authToggleBtn = document.getElementById("authToggleBtn");
const authSwitchText = document.getElementById("authSwitchText");
const authMessage = document.getElementById("authMessage");

// Task elements
const taskForm = document.getElementById("taskForm");
const taskTitle = document.getElementById("taskTitle");
const taskPriority = document.getElementById("taskPriority");
const taskDueDate = document.getElementById("taskDueDate");
const taskList = document.getElementById("taskList");
const appMessage = document.getElementById("appMessage");
const addTaskBtn = document.getElementById("addTaskBtn");
const taskSearch = document.getElementById("taskSearch");
const priorityFilter = document.getElementById("priorityFilter");

// Edit modal elements
const editModal = document.getElementById("editModal");
const editTaskForm = document.getElementById("editTaskForm");
const editTitle = document.getElementById("editTitle");
const editPriority = document.getElementById("editPriority");
const editDueDate = document.getElementById("editDueDate");
const cancelEditBtn = document.getElementById("cancelEditBtn");

// ---------------- AUTHENTICATION ----------------

function showAuthMessage(message) {
    authMessage.textContent = message;
}

authToggleBtn.addEventListener("click", () => {
    authMode = authMode === "login" ? "register" : "login";

    const isRegister = authMode === "register";

    authTitle.textContent = isRegister
        ? "Create Account"
        : "Welcome Back!";

    authSubtitle.textContent = isRegister
        ? "Register to start managing your tasks."
        : "Login to access your workspace.";

    authEmail.classList.toggle("hidden", !isRegister);
    authEmail.required = isRegister;

    authSubmitBtn.textContent = isRegister ? "Register" : "Login";

    authSwitchText.textContent = isRegister
        ? "Already have an account?"
        : "Don't have an account?";

    authToggleBtn.textContent = isRegister ? "Login" : "Register";

    authForm.reset();
    showAuthMessage("");
});

async function authenticate(event) {
    event.preventDefault();
    showAuthMessage("");

    const username = authUsername.value.trim();
    const password = authPassword.value;

    try {
        let response;

        if (authMode === "register") {
            response = await fetch(`${AUTH_URL}/register`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    username,
                    email: authEmail.value.trim(),
                    password
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || "Registration failed");
            }

            authMode = "login";

            authTitle.textContent = "Welcome Back!";
            authSubtitle.textContent = "Account created! Please login.";

            authEmail.classList.add("hidden");
            authEmail.required = false;

            authSubmitBtn.textContent = "Login";
            authSwitchText.textContent = "Don't have an account?";
            authToggleBtn.textContent = "Register";

            authForm.reset();

            showAuthMessage("Registration successful! Please login.");
            return;
        }

        response = await fetch(`${AUTH_URL}/login`, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded"
            },
            body: new URLSearchParams({
                username,
                password
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || "Login failed");
        }

        const data = await response.json();

        authToken = data.access_token;
        localStorage.setItem("taskflow_token", authToken);

        currentUsername = data.username;
        localStorage.setItem("taskflow_username", currentUsername);

        displayUsername.textContent = currentUsername;
        userAvatar.textContent = currentUsername.charAt(0).toUpperCase();

        showDashboard();
        await loadTasks();

    } catch (error) {
        showAuthMessage(error.message);
        console.error("Authentication error:", error);
    }
}

authForm.addEventListener("submit", authenticate);

function showDashboard() {
    authSection.classList.add("hidden");
    dashboard.classList.remove("hidden");

    if (currentUsername) {
        displayUsername.textContent = currentUsername;
        userAvatar.textContent = currentUsername.charAt(0).toUpperCase();
    }
}

// ---------------- NOTIFICATIONS ----------------

function showMessage(message, type = "info") {
    appMessage.replaceChildren();

    const text = document.createElement("span");
    text.textContent = message;

    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.textContent = "×";
    closeButton.setAttribute("aria-label", "Dismiss message");

    closeButton.style.cssText =
        "float:right;border:0;background:transparent;" +
        "font-size:18px;cursor:pointer;margin-left:12px;";

    closeButton.addEventListener("click", hideMessage);

    appMessage.append(text, closeButton);
    appMessage.className = `app-message ${type}`;
}

function hideMessage() {
    appMessage.textContent = "";
    appMessage.className = "app-message hidden";
}

// ---------------- API REQUEST ----------------

async function apiRequest(url, options = {}) {
    const headers = {
        ...(options.headers || {})
    };

    if (authToken) {
        headers["Authorization"] = `Bearer ${authToken}`;
    }

    const response = await fetch(url, {
        ...options,
        headers
    });

    if (!response.ok) {
        let message = `Request failed (${response.status})`;

        try {
            const body = await response.json();

            if (body.detail) {
                message = body.detail;
            }
        } catch {
            // Keep default error message
        }

        const error = new Error(message);
        error.status = response.status;

        throw error;
    }

    return response;
}

// ---------------- LOAD TASKS ----------------

async function loadTasks() {
    taskList.textContent = "Loading tasks...";

    try {
        const response = await apiRequest(API_URL);

        tasks = await response.json();

        renderTasks();

    } catch (error) {
        if (error.status === 401) {
            logout();
            showAuthMessage("Your session expired. Please login again.");
            return;
        }

        taskList.replaceChildren();

        showMessage(
            "Couldn't load tasks. Check that the backend is running, then refresh.",
            "error"
        );

        console.error("Load tasks error:", error);
    }
}

// ---------------- ADD TASK ----------------

addTaskBtn.addEventListener("click", () => {
    taskForm.classList.toggle("hidden");

    if (!taskForm.classList.contains("hidden")) {
        taskTitle.focus();
    }
});

taskForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const title = taskTitle.value.trim();

    if (!title) return;

    try {
        await apiRequest(API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                title,
                priority: taskPriority.value,
                completed: false,
                due_date: taskDueDate.value || null
            })
        });

        taskForm.reset();
        taskForm.classList.add("hidden");

        await loadTasks();

        showMessage("Task added successfully!", "success");

    } catch (error) {
        showMessage("Unable to add task. Please try again.", "error");
        console.error("Add task error:", error);
    }
});

// ---------------- SEARCH TASKS ----------------

taskSearch.addEventListener("input", () => {
    currentSearch = taskSearch.value.trim().toLowerCase();
    renderTasks();
});

// ---------------- STATUS FILTER ----------------

document.querySelectorAll(".nav-item").forEach((button) => {
    button.addEventListener("click", () => {
        currentFilter = button.dataset.filter;

        document.querySelectorAll(".nav-item").forEach((item) => {
            item.classList.toggle("active", item === button);
        });

        renderTasks();
    });
});

// ---------------- PRIORITY FILTER ----------------

if (priorityFilter) {
    priorityFilter.addEventListener("change", () => {
        currentPriority = priorityFilter.value;
        renderTasks();
    });
}

// ---------------- UPDATE TASK ----------------

async function updateTask(task, changes) {
    try {
        await apiRequest(`${API_URL}/${task.id}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                ...task,
                ...changes
            })
        });

        await loadTasks();

        showMessage("Task updated successfully!", "success");

        return true;

    } catch (error) {
        showMessage("Unable to update task. Please try again.", "error");
        console.error("Update task error:", error);

        return false;
    }
}

// ---------------- DELETE TASK ----------------

async function deleteTask(taskId) {
    const confirmDelete = confirm(
        "Are you sure you want to delete this task? This action cannot be undone."
    );

    if (!confirmDelete) return;

    try {
        await apiRequest(`${API_URL}/${taskId}`, {
            method: "DELETE"
        });

        await loadTasks();

        showMessage("Task deleted successfully.", "success");

    } catch (error) {
        showMessage("Unable to delete task. Please try again.", "error");
        console.error("Delete error:", error);
    }
}

// ---------------- EDIT TASK MODAL ----------------

function openEditModal(task) {
    editingTask = task;

    editTitle.value = task.title;
    editPriority.value = task.priority;
    editDueDate.value = task.due_date || "";

    editModal.classList.remove("hidden");
    editTitle.focus();
}

function closeEditModal() {
    editModal.classList.add("hidden");

    editingTask = null;
    editTaskForm.reset();
}

cancelEditBtn.addEventListener("click", closeEditModal);

editModal.addEventListener("click", (event) => {
    if (event.target === editModal) {
        closeEditModal();
    }
});

editTaskForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!editingTask) return;

    const title = editTitle.value.trim();
    const priority = editPriority.value;
    const dueDate = editDueDate.value || null;

    if (!title) {
        showMessage("Task title cannot be empty.", "error");
        return;
    }

    const taskToUpdate = editingTask;

    const success = await updateTask(taskToUpdate, {
        title,
        priority,
        due_date: dueDate
    });

    if (success) {
        closeEditModal();
    }
});

// ---------------- DUE DATE HELPERS ----------------

// Get today's date in local YYYY-MM-DD format.
function getLocalDateString() {
    const today = new Date();

    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

// Convert YYYY-MM-DD into a local Date object.
function parseLocalDate(dateString) {
    if (!dateString) return null;

    const parts = dateString.split("-").map(Number);

    if (parts.length !== 3 || parts.some(Number.isNaN)) {
        return null;
    }

    const [year, month, day] = parts;

    const date = new Date(year, month - 1, day);

    // Reject invalid dates.
    if (
        date.getFullYear() !== year ||
        date.getMonth() !== month - 1 ||
        date.getDate() !== day
    ) {
        return null;
    }

    return date;
}

// Format date for display.
function formatDueDate(dateString) {
    const date = parseLocalDate(dateString);

    if (!date) return "";

    return date.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric"
    });
}

// Create deadline information for a task card.
function createDueDateElement(task) {
    if (!task.due_date) return null;

    const deadline = document.createElement("p");
    deadline.className = "due-date";

    const formattedDate = formatDueDate(task.due_date);

    if (!formattedDate) return null;

    const dueDate = parseLocalDate(task.due_date);
    const today = parseLocalDate(getLocalDateString());

    const millisecondsPerDay = 24 * 60 * 60 * 1000;

    const daysUntilDue = Math.round(
        (dueDate.getTime() - today.getTime()) / millisecondsPerDay
    );

    if (task.completed) {
        deadline.classList.add("completed-deadline");
        deadline.textContent = `Deadline: ${formattedDate}`;
    } else if (daysUntilDue < 0) {
        deadline.classList.add("overdue");
        deadline.textContent = `⚠ Overdue · ${formattedDate}`;
    } else if (daysUntilDue === 0) {
        deadline.classList.add("due-today");
        deadline.textContent = `● Due today · ${formattedDate}`;
    } else if (daysUntilDue <= 3) {
        deadline.classList.add("upcoming");
        deadline.textContent = `◷ Due in ${daysUntilDue} day(s) · ${formattedDate}`;
    } else {
        deadline.classList.add("normal-deadline");
        deadline.textContent = `Due: ${formattedDate}`;
    }

    return deadline;
}

// ---------------- RENDER TASKS ----------------

function renderTasks() {

    // Update dashboard statistics.
    document.getElementById("totalCount").textContent = tasks.length;

    document.getElementById("pendingCount").textContent =
        tasks.filter((task) => !task.completed).length;

    document.getElementById("completedCount").textContent =
        tasks.filter((task) => task.completed).length;

    // Apply status filter, search and priority filter.
    const visibleTasks = tasks.filter((task) => {

        const matchesFilter =
            currentFilter === "all" ||
            (currentFilter === "pending" && !task.completed) ||
            (currentFilter === "completed" && task.completed);

        const matchesSearch = task.title
            .toLowerCase()
            .includes(currentSearch);

        const matchesPriority =
            currentPriority === "all" ||
            task.priority.toLowerCase() === currentPriority;

        return matchesFilter && matchesSearch && matchesPriority;
    });

    taskList.replaceChildren();

    // Empty state.
    if (visibleTasks.length === 0) {

        const empty = document.createElement("div");
        empty.className = "empty-state";

        const icon = document.createElement("div");
        icon.className = "empty-icon";

        const heading = document.createElement("h3");
        const message = document.createElement("p");

        if (currentSearch) {
            icon.textContent = "🔍";
            heading.textContent = "No matching tasks found";
            message.textContent =
                `We couldn't find any tasks matching "${taskSearch.value}".`;
        } else if (currentPriority !== "all") {
            icon.textContent = "🎯";
            heading.textContent = `No ${currentPriority} priority tasks`;
            message.textContent =
                "Try selecting another priority to see more tasks.";
        } else {
            icon.textContent =
                currentFilter === "completed" ? "✓" : "📝";

            heading.textContent =
                currentFilter === "pending"
                    ? "All caught up!"
                    : currentFilter === "completed"
                    ? "No completed tasks yet"
                    : "Your workspace is empty";

            message.textContent =
                currentFilter === "pending"
                    ? "You have no pending tasks. Great work!"
                    : currentFilter === "completed"
                    ? "Complete a task and it will appear here."
                    : "Start organizing your day by adding your first task.";
        }

        empty.append(icon, heading, message);
        taskList.appendChild(empty);

        return;
    }

    // Render visible task cards.
    visibleTasks.forEach((task) => {

        const card = document.createElement("article");
        card.className = `task-card${task.completed ? " done" : ""}`;

        // Checkbox.
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = task.completed;
        checkbox.setAttribute("aria-label", `Complete ${task.title}`);

        checkbox.addEventListener("change", () => {
            updateTask(task, {
                completed: checkbox.checked
            });
        });

        // Task information.
        const info = document.createElement("div");
        info.className = "task-info";

        const title = document.createElement("h3");
        title.textContent = task.title;

        const status = document.createElement("p");
        status.textContent = task.completed
            ? "Completed"
            : "In progress";

        info.append(title, status);

        // Deadline information.
        const deadline = createDueDateElement(task);

        if (deadline) {
            info.appendChild(deadline);

            if (
                deadline.classList.contains("overdue") &&
                !task.completed
            ) {
                card.classList.add("overdue-task");
            }
        }

        // Priority.
        const priority = document.createElement("span");
        priority.className = `priority ${task.priority}`;
        priority.textContent = task.priority;

        // Edit button.
        const editButton = document.createElement("button");
        editButton.className = "edit-btn";
        editButton.textContent = "Edit";

        editButton.addEventListener("click", () => {
            openEditModal(task);
        });

        // Delete button.
        const deleteButton = document.createElement("button");
        deleteButton.className = "delete-btn";
        deleteButton.textContent = "×";

        deleteButton.setAttribute(
            "aria-label",
            `Delete ${task.title}`
        );

        deleteButton.addEventListener("click", () => {
            deleteTask(task.id);
        });

        card.append(
            checkbox,
            info,
            priority,
            editButton,
            deleteButton
        );

        taskList.appendChild(card);
    });
}

// ---------------- LOGOUT ----------------

function logout() {
    localStorage.removeItem("taskflow_token");
    authToken = null;

    localStorage.removeItem("taskflow_username");
    currentUsername = "";

    tasks = [];
    currentSearch = "";
    currentFilter = "all";
    currentPriority = "all";

    taskSearch.value = "";

    if (priorityFilter) {
        priorityFilter.value = "all";
    }

    taskForm.reset();
    taskForm.classList.add("hidden");

    taskList.replaceChildren();

    closeEditModal();
    hideMessage();

    document.querySelectorAll(".nav-item").forEach((item) => {
        item.classList.toggle("active", item.dataset.filter === "all");
    });

    dashboard.classList.add("hidden");
    authSection.classList.remove("hidden");

    authForm.reset();
    showAuthMessage("You have been logged out.");
}

document.getElementById("logoutBtn").addEventListener("click", logout);

// ---------------- INITIALIZE APP ----------------

async function initializeApp() {
    if (authToken) {
        showDashboard();
        await loadTasks();
    } else {
        authSection.classList.remove("hidden");
        dashboard.classList.add("hidden");
    }
}

initializeApp();
