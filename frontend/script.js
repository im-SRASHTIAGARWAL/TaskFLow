
const API_URL = "http://127.0.0.1:8000/tasks";

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
    const response = await fetch(url, options);

    if (!response.ok) {
        let message = `Request failed (${response.status})`;

        try {
            const body = await response.json();
            if (body.detail) {
                message = body.detail;
            }
        } catch {
            // Keep the default error message if no JSON body exists.
        }

        throw new Error(message);
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
    } catch (error) {
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
        const response = await fetch(`${API_URL}/${task.id}`, {
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
        const response = await fetch(`${API_URL}/${taskId}`, {
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

loadTasks();
