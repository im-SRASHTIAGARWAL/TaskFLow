
const API_URL = "https://taskflow-api-wbfe.onrender.com/tasks";
const AUTH_URL = "https://taskflow-api-wbfe.onrender.com/auth";

const VALID_CATEGORIES = ["Study", "Work", "Personal", "Projects"];

let authMode = "login";
let authToken = localStorage.getItem("taskflow_token");
let currentUsername = localStorage.getItem("taskflow_username") || "";

let tasks = [];

let currentFilter = "all";
let currentSearch = "";
let currentPriority = "all";
let currentCategory = "all";
let currentSort = "newest";

let editingTask = null;

let currentView = "list";
let calendarMode = "month";
let calendarDate = new Date();


// ---------------- DOM ELEMENTS ----------------

// Authentication
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

// User
const userAvatar = document.getElementById("userAvatar");
const displayUsername = document.getElementById("displayUsername");

// Task form
const taskForm = document.getElementById("taskForm");
const taskTitle = document.getElementById("taskTitle");
const taskPriority = document.getElementById("taskPriority");
const taskCategory = document.getElementById("taskCategory");
const taskDueDate = document.getElementById("taskDueDate");

const taskList = document.getElementById("taskList");
const appMessage = document.getElementById("appMessage");
const addTaskBtn = document.getElementById("addTaskBtn");

// Filters
const taskSearch = document.getElementById("taskSearch");
const priorityFilter = document.getElementById("priorityFilter");
const categoryFilter = document.getElementById("categoryFilter");
const sortFilter = document.getElementById("sortFilter");

// Edit modal
const editModal = document.getElementById("editModal");
const editTaskForm = document.getElementById("editTaskForm");
const editTitle = document.getElementById("editTitle");
const editPriority = document.getElementById("editPriority");
const editCategory = document.getElementById("editCategory");
const editDueDate = document.getElementById("editDueDate");
const cancelEditBtn = document.getElementById("cancelEditBtn");

// Calendar
const taskView = document.getElementById("taskView");
const calendarViewElement = document.getElementById("calendarView");

const listViewBtn = document.getElementById("listViewBtn");
const calendarViewBtn = document.getElementById("calendarViewBtn");

const calendarTitle = document.getElementById("calendarTitle");
const calendarGrid = document.getElementById("calendarGrid");

const prevCalendarBtn = document.getElementById("prevCalendarBtn");
const nextCalendarBtn = document.getElementById("nextCalendarBtn");

const monthViewBtn = document.getElementById("monthViewBtn");
const weekViewBtn = document.getElementById("weekViewBtn");


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

        updateUserDetails();

        showDashboard();
        await loadTasks();

    } catch (error) {
        showAuthMessage(error.message);
        console.error("Authentication error:", error);
    }
}


authForm.addEventListener("submit", authenticate);


function updateUserDetails() {
    displayUsername.textContent = currentUsername;

    userAvatar.textContent = currentUsername
        ? currentUsername.charAt(0).toUpperCase()
        : "U";
}


function showDashboard() {
    authSection.classList.add("hidden");
    dashboard.classList.remove("hidden");

    updateUserDetails();
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
        headers.Authorization = `Bearer ${authToken}`;
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
            // Keep default error message.
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
            "Couldn't load tasks. Please check the backend and refresh.",
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
    const category = taskCategory.value;

    if (!title) return;

    if (!VALID_CATEGORIES.includes(category)) {
        showMessage("Please select a valid category.", "error");
        return;
    }

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
                due_date: taskDueDate.value || null,
                category
            })
        });

        taskForm.reset();
        taskForm.classList.add("hidden");

        await loadTasks();

        showMessage("Task added successfully!", "success");

    } catch (error) {
        showMessage(error.message || "Unable to add task.", "error");
        console.error("Add task error:", error);
    }
});


// ---------------- FILTERS ----------------

taskSearch.addEventListener("input", () => {
    currentSearch = taskSearch.value.trim().toLowerCase();
    renderTasks();
});


priorityFilter.addEventListener("change", () => {
    currentPriority = priorityFilter.value;
    renderTasks();
});


categoryFilter.addEventListener("change", () => {
    currentCategory = categoryFilter.value;
    updateCategoryNavigation();
    renderTasks();
});


sortFilter.addEventListener("change", () => {
    currentSort = sortFilter.value;
    renderTasks();
});


// Status navigation
document.querySelectorAll(".nav-item[data-filter]").forEach((button) => {
    button.addEventListener("click", () => {
        currentFilter = button.dataset.filter;

        document.querySelectorAll(".nav-item[data-filter]").forEach((item) => {
            item.classList.toggle("active", item === button);
        });

        renderTasks();
    });
});


// Category navigation
document.querySelectorAll(".category-nav").forEach((button) => {
    button.addEventListener("click", () => {
        currentCategory = button.dataset.category;

        categoryFilter.value = currentCategory;

        updateCategoryNavigation();
        renderTasks();
    });
});


function updateCategoryNavigation() {
    document.querySelectorAll(".category-nav").forEach((button) => {
        button.classList.toggle(
            "active",
            button.dataset.category === currentCategory
        );
    });
}


// ---------------- UPDATE TASK ----------------

async function updateTask(task, changes) {
    try {
        const updatedTask = {
            title: task.title,
            priority: task.priority,
            completed: task.completed,
            due_date: task.due_date || null,
            category: task.category || "Personal",
            ...changes
        };

        await apiRequest(`${API_URL}/${task.id}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(updatedTask)
        });

        await loadTasks();

        showMessage("Task updated successfully!", "success");

        return true;

    } catch (error) {
        showMessage(error.message || "Unable to update task.", "error");
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
    editCategory.value = task.category || "Personal";
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
    const category = editCategory.value;
    const dueDate = editDueDate.value || null;

    if (!title) {
        showMessage("Task title cannot be empty.", "error");
        return;
    }

    const taskToUpdate = editingTask;

    const success = await updateTask(taskToUpdate, {
        title,
        priority,
        category,
        due_date: dueDate
    });

    if (success) {
        closeEditModal();
    }
});


// ---------------- DATE HELPERS ----------------

function getLocalDateString(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}


function parseLocalDate(dateString) {
    if (!dateString) return null;

    const parts = dateString.split("-").map(Number);

    if (parts.length !== 3 || parts.some(Number.isNaN)) {
        return null;
    }

    const [year, month, day] = parts;

    const date = new Date(year, month - 1, day);

    if (
        date.getFullYear() !== year ||
        date.getMonth() !== month - 1 ||
        date.getDate() !== day
    ) {
        return null;
    }

    return date;
}


function formatDueDate(dateString) {
    const date = parseLocalDate(dateString);

    if (!date) return "";

    return date.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric"
    });
}


function getDaysDifference(dateString) {
    const dueDate = parseLocalDate(dateString);
    const today = parseLocalDate(getLocalDateString());

    if (!dueDate || !today) return null;

    const millisecondsPerDay = 24 * 60 * 60 * 1000;

    return Math.round(
        (dueDate.getTime() - today.getTime()) / millisecondsPerDay
    );
}


function isOverdue(task) {
    if (task.completed || !task.due_date) return false;

    const difference = getDaysDifference(task.due_date);

    return difference !== null && difference < 0;
}


// ---------------- DUE DATE DISPLAY ----------------

function createDueDateElement(task) {
    if (!task.due_date) return null;

    const formattedDate = formatDueDate(task.due_date);

    if (!formattedDate) return null;

    const deadline = document.createElement("p");
    deadline.className = "due-date";

    const daysUntilDue = getDaysDifference(task.due_date);

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


// ---------------- TASK FILTERING ----------------

function getFilteredTasks() {
    let filteredTasks = tasks.filter((task) => {
        const matchesStatus =
            currentFilter === "all" ||
            (currentFilter === "pending" && !task.completed) ||
            (currentFilter === "completed" && task.completed);

        const matchesSearch = task.title
            .toLowerCase()
            .includes(currentSearch);

        const matchesPriority =
            currentPriority === "all" ||
            task.priority.toLowerCase() === currentPriority;

        const matchesCategory =
            currentCategory === "all" ||
            (task.category || "Personal") === currentCategory;

        return (
            matchesStatus &&
            matchesSearch &&
            matchesPriority &&
            matchesCategory
        );
    });

    return sortTasks(filteredTasks);
}


// ---------------- TASK SORTING ----------------

function getPriorityValue(priority) {
    const values = {
        High: 3,
        Medium: 2,
        Low: 1
    };

    return values[priority] || 0;
}


function getCreatedTimestamp(task) {
    if (!task.created_at) return 0;

    const timestamp = new Date(task.created_at).getTime();

    return Number.isNaN(timestamp) ? 0 : timestamp;
}


function sortTasks(taskArray) {
    const sorted = [...taskArray];

    switch (currentSort) {

        case "newest":
            sorted.sort((a, b) => {
                return getCreatedTimestamp(b) - getCreatedTimestamp(a);
            });
            break;

        case "oldest":
            sorted.sort((a, b) => {
                return getCreatedTimestamp(a) - getCreatedTimestamp(b);
            });
            break;

        case "due_asc":
            sorted.sort((a, b) => {
                if (!a.due_date && !b.due_date) return 0;
                if (!a.due_date) return 1;
                if (!b.due_date) return -1;

                return a.due_date.localeCompare(b.due_date);
            });
            break;

        case "due_desc":
            sorted.sort((a, b) => {
                if (!a.due_date && !b.due_date) return 0;
                if (!a.due_date) return 1;
                if (!b.due_date) return -1;

                return b.due_date.localeCompare(a.due_date);
            });
            break;

        case "priority":
            sorted.sort((a, b) => {
                return (
                    getPriorityValue(b.priority) -
                    getPriorityValue(a.priority)
                );
            });
            break;
    }

    return sorted;
}


// ---------------- DASHBOARD ANALYTICS ----------------

function updateDashboardStats() {
    const total = tasks.length;

    const pending = tasks.filter(
        (task) => !task.completed
    ).length;

    const completed = tasks.filter(
        (task) => task.completed
    ).length;

    const overdue = tasks.filter(isOverdue).length;

    document.getElementById("totalCount").textContent = total;
    document.getElementById("pendingCount").textContent = pending;
    document.getElementById("completedCount").textContent = completed;
    document.getElementById("overdueCount").textContent = overdue;
}


// ---------------- EMPTY STATE ----------------

function createEmptyState() {
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

    } else if (currentCategory !== "all") {
        icon.textContent = "📁";
        heading.textContent = `No ${currentCategory} tasks`;
        message.textContent =
            "Try another category or add a new task.";

    } else if (currentPriority !== "all") {
        icon.textContent = "🎯";
        heading.textContent = `No ${currentPriority} priority tasks`;
        message.textContent =
            "Try selecting another priority.";

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

    return empty;
}


// ---------------- TASK CARD ----------------

function createTaskCard(task) {
    const card = document.createElement("article");

    card.className = `task-card${task.completed ? " done" : ""}`;

    if (isOverdue(task)) {
        card.classList.add("overdue-task");
    }

    // Checkbox
    const checkbox = document.createElement("input");

    checkbox.type = "checkbox";
    checkbox.checked = task.completed;
    checkbox.setAttribute("aria-label", `Complete ${task.title}`);

    checkbox.addEventListener("change", () => {
        updateTask(task, {
            completed: checkbox.checked
        });
    });

    // Information
    const info = document.createElement("div");
    info.className = "task-info";

    const title = document.createElement("h3");
    title.textContent = task.title;

    const status = document.createElement("p");
    status.textContent = task.completed
        ? "Completed"
        : "In progress";

    info.append(title, status);

    // Category badge
    const category = document.createElement("span");

    category.className = `category-badge ${task.category || "Personal"}`;
    category.textContent = task.category || "Personal";

    info.appendChild(category);

    // Due date
    const deadline = createDueDateElement(task);

    if (deadline) {
        info.appendChild(deadline);
    }

    // Priority
    const priority = document.createElement("span");

    priority.className = `priority ${task.priority}`;
    priority.textContent = task.priority;

    // Edit
    const editButton = document.createElement("button");

    editButton.className = "edit-btn";
    editButton.textContent = "Edit";

    editButton.addEventListener("click", () => {
        openEditModal(task);
    });

    // Delete
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

    return card;
}


// ---------------- RENDER TASKS ----------------

function renderTasks() {
    updateDashboardStats();

    const visibleTasks = getFilteredTasks();

    taskList.replaceChildren();

    if (visibleTasks.length === 0) {
        taskList.appendChild(createEmptyState());
    } else {
        visibleTasks.forEach((task) => {
            taskList.appendChild(createTaskCard(task));
        });
    }

    if (currentView === "calendar") {
        renderCalendar();
    }
}


// ---------------- VIEW SWITCHER ----------------

listViewBtn.addEventListener("click", () => {
    currentView = "list";

    taskView.classList.remove("hidden");
    calendarViewElement.classList.add("hidden");

    listViewBtn.classList.add("active");
    calendarViewBtn.classList.remove("active");
});


calendarViewBtn.addEventListener("click", () => {
    currentView = "calendar";

    taskView.classList.add("hidden");
    calendarViewElement.classList.remove("hidden");

    calendarViewBtn.classList.add("active");
    listViewBtn.classList.remove("active");

    renderCalendar();
});


// ---------------- CALENDAR MODE ----------------

monthViewBtn.addEventListener("click", () => {
    calendarMode = "month";

    monthViewBtn.classList.add("active");
    weekViewBtn.classList.remove("active");

    renderCalendar();
});


weekViewBtn.addEventListener("click", () => {
    calendarMode = "week";

    weekViewBtn.classList.add("active");
    monthViewBtn.classList.remove("active");

    renderCalendar();
});


prevCalendarBtn.addEventListener("click", () => {
    if (calendarMode === "month") {
        calendarDate.setMonth(calendarDate.getMonth() - 1);
    } else {
        calendarDate.setDate(calendarDate.getDate() - 7);
    }

    renderCalendar();
});


nextCalendarBtn.addEventListener("click", () => {
    if (calendarMode === "month") {
        calendarDate.setMonth(calendarDate.getMonth() + 1);
    } else {
        calendarDate.setDate(calendarDate.getDate() + 7);
    }

    renderCalendar();
});


// ---------------- CALENDAR HELPERS ----------------

function startOfWeek(date) {
    const result = new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate()
    );

    const day = result.getDay();

    const difference = day === 0 ? -6 : 1 - day;

    result.setDate(result.getDate() + difference);

    return result;
}


function addDays(date, days) {
    const result = new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate()
    );

    result.setDate(result.getDate() + days);

    return result;
}


function formatCalendarHeading(date) {
    return date.toLocaleDateString("en-IN", {
        month: "long",
        year: "numeric"
    });
}


// ---------------- CALENDAR RENDERING ----------------

function renderCalendar() {
    if (!calendarGrid) return;

    calendarGrid.replaceChildren();

    const visibleTasks = getFilteredTasks();

    if (calendarMode === "month") {
        renderMonthCalendar(visibleTasks);
    } else {
        renderWeekCalendar(visibleTasks);
    }
}


function renderMonthCalendar(visibleTasks) {
    calendarTitle.textContent = formatCalendarHeading(calendarDate);

    const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

    weekdays.forEach((day) => {
        const heading = document.createElement("div");

        heading.className = "calendar-weekday";
        heading.textContent = day;

        calendarGrid.appendChild(heading);
    });

    const firstDay = new Date(
        calendarDate.getFullYear(),
        calendarDate.getMonth(),
        1
    );

    const gridStart = startOfWeek(firstDay);

    for (let i = 0; i < 42; i++) {
        const date = addDays(gridStart, i);

        const cell = createCalendarDay(date, visibleTasks);

        if (date.getMonth() !== calendarDate.getMonth()) {
            cell.classList.add("other-month");
        }

        calendarGrid.appendChild(cell);
    }
}


function renderWeekCalendar(visibleTasks) {
    const weekStart = startOfWeek(calendarDate);
    const weekEnd = addDays(weekStart, 6);

    calendarTitle.textContent =
        `${weekStart.toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short"
        })} – ${weekEnd.toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric"
        })}`;

    const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

    weekdays.forEach((day) => {
        const heading = document.createElement("div");

        heading.className = "calendar-weekday";
        heading.textContent = day;

        calendarGrid.appendChild(heading);
    });

    for (let i = 0; i < 7; i++) {
        const date = addDays(weekStart, i);

        const cell = createCalendarDay(date, visibleTasks);

        cell.classList.add("week-day-cell");

        calendarGrid.appendChild(cell);
    }
}


function createCalendarDay(date, visibleTasks) {
    const cell = document.createElement("div");

    cell.className = "calendar-day";

    const dateString = getLocalDateString(date);
    const todayString = getLocalDateString();

    if (dateString === todayString) {
        cell.classList.add("today");
    }

    const dateNumber = document.createElement("span");

    dateNumber.className = "calendar-date-number";
    dateNumber.textContent = date.getDate();

    cell.appendChild(dateNumber);

    const dayTasks = visibleTasks.filter((task) => {
        return task.due_date === dateString;
    });

    dayTasks.forEach((task) => {
        const event = document.createElement("button");

        event.type = "button";
        event.className = "calendar-event";

        if (task.completed) {
            event.classList.add("completed-event");
        } else if (isOverdue(task)) {
            event.classList.add("overdue-event");
        } else {
            event.classList.add("pending-event");
        }

        event.textContent = task.title;
        event.title = `${task.title} · ${task.category || "Personal"}`;

        event.addEventListener("click", () => {
            openEditModal(task);
        });

        cell.appendChild(event);
    });

    return cell;
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
    currentCategory = "all";
    currentSort = "newest";

    taskSearch.value = "";
    priorityFilter.value = "all";
    categoryFilter.value = "all";
    sortFilter.value = "newest";

    taskForm.reset();
    taskForm.classList.add("hidden");

    taskList.replaceChildren();

    closeEditModal();
    hideMessage();

    document.querySelectorAll(".nav-item").forEach((item) => {
        item.classList.toggle(
            "active",
            item.dataset.filter === "all"
        );
    });

    updateCategoryNavigation();

    currentView = "list";
    calendarMode = "month";
    calendarDate = new Date();

    taskView.classList.remove("hidden");
    calendarViewElement.classList.add("hidden");

    listViewBtn.classList.add("active");
    calendarViewBtn.classList.remove("active");

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
