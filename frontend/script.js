
const API_URL = "https://taskflow-api-wbfe.onrender.com/tasks";


const AUTH_URL = "https://taskflow-api-wbfe.onrender.com/auth";

let authMode = "login";
let authToken = localStorage.getItem("taskflow_token");

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

function showAuthMessage(message) {
    authMessage.textContent = message;
}

authToggleBtn.addEventListener("click", () => {
    authMode = authMode === "login" ? "register" : "login";

    const isRegister = authMode === "register";

    authTitle.textContent = isRegister ? "Create Account" : "Welcome Back!";
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

        authSection.classList.add("hidden");
        dashboard.classList.remove("hidden");

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
}


const taskForm = document.getElementById("taskForm");
const taskTitle = document.getElementById("taskTitle");
const taskPriority = document.getElementById("taskPriority");
const taskList = document.getElementById("taskList");


const appMessage = document.getElementById("appMessage");
const addTaskBtn = document.getElementById("addTaskBtn");


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


let tasks = [];
let currentFilter = "all";


async function loadTasks() {
    taskList.textContent = "Loading tasks...";

    try {
        const response = await apiRequest(API_URL);
        tasks = await response.json();
        renderTasks();
    } 
    catch (error) {
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


document.getElementById("addTaskBtn").addEventListener("click", () => {
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
        const response = await apiRequest(API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                title,
                priority: taskPriority.value,
                completed: false
            })
        });

        if (!response.ok) {
            throw new Error("Could not create task");
        }

        taskForm.reset();
        taskForm.classList.add("hidden");
        await loadTasks();
        showMessage("Task added successfully!", "success");
    } catch (error) {
        alert("Unable to add task. Please check the backend.");
        console.error(error);
    }
});

document.querySelectorAll(".nav-item").forEach((button) => {
    button.addEventListener("click", () => {
        currentFilter = button.dataset.filter;

        document.querySelectorAll(".nav-item").forEach((item) => {
            item.classList.toggle("active", item === button);
        });

        renderTasks();
    });
});

async function updateTask(task, changes) {
    try {
        const response = await apiRequest(`${API_URL}/${task.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...task, ...changes })
        });

        if (!response.ok) {
            throw new Error("Could not update task");
        }

        await loadTasks();

        showMessage("Task updated successfully!", "success");
    } catch (error) {
        alert("Unable to update task.");
        console.error(error);
    }
}

async function deleteTask(taskId) {
    try {
        const response = await apiRequest(`${API_URL}/${taskId}`, {
            method: "DELETE"
        });

        if (!response.ok) {
            throw new Error("Could not delete task");
        }
        showMessage("Task deleted successfully.", "success");
        await loadTasks();
    } catch (error) {
        alert("Unable to delete task.");
        console.error(error);
    }
}

function renderTasks() {
    const visibleTasks = tasks.filter((task) => {
        if (currentFilter === "pending") return !task.completed;
        if (currentFilter === "completed") return task.completed;
        return true;
    });

    document.getElementById("totalCount").textContent = tasks.length;
    document.getElementById("pendingCount").textContent =
        tasks.filter((task) => !task.completed).length;
    document.getElementById("completedCount").textContent =
        tasks.filter((task) => task.completed).length;

    taskList.replaceChildren();

    if (visibleTasks.length === 0) {
        const empty = document.createElement("p");
        empty.className = "empty-state";
        empty.textContent = "No tasks here yet. Add one to get started!";
        taskList.appendChild(empty);
        return;
    }

    visibleTasks.forEach((task) => {
        const card = document.createElement("article");
        card.className = `task-card${task.completed ? " done" : ""}`;

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = task.completed;
        checkbox.setAttribute("aria-label", `Complete ${task.title}`);

        checkbox.addEventListener("change", () => {
            updateTask(task, { completed: checkbox.checked });
        });

        const info = document.createElement("div");
        info.className = "task-info";

        const title = document.createElement("h3");
        title.textContent = task.title;

        const status = document.createElement("p");
        status.textContent = task.completed ? "Completed" : "In progress";

        info.append(title, status);

        const priority = document.createElement("span");
        priority.className = `priority ${task.priority}`;
        priority.textContent = task.priority;

        
    const editButton = document.createElement("button");
    editButton.className = "edit-btn";
    editButton.textContent = "Edit";
    editButton.addEventListener("click", () => {
        const newTitle = prompt("Edit task title:", task.title);

        if (newTitle === null) return;

        const title = newTitle.trim();

        if (!title) {
            alert("Task title cannot be empty.");
            return;
        }

        const newPriority = prompt(
            "Priority: Low, Medium, or High",
            task.priority
        );

        if (newPriority === null) return;

        const priority = newPriority.trim();

        if (!["Low", "Medium", "High"].includes(priority)) {
            alert("Please enter Low, Medium, or High.");
            return;
        }

        updateTask(task, { title, priority });
    });

    const deleteButton = document.createElement("button");
    deleteButton.className = "delete-btn";
    deleteButton.textContent = "×";
    deleteButton.setAttribute("aria-label", `Delete ${task.title}`);

    deleteButton.addEventListener("click", () => {
        deleteTask(task.id);
    });
        card.append(checkbox, info, priority,editButton, deleteButton);
        taskList.appendChild(card);
    });
}

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

function logout() {
    localStorage.removeItem("taskflow_token");
    authToken = null;

    tasks = [];
    taskList.replaceChildren();

    dashboard.classList.add("hidden");
    authSection.classList.remove("hidden");

    authForm.reset();
    hideMessage();
    showAuthMessage("You have been logged out.");
}

document.getElementById("logoutBtn").addEventListener("click", logout);