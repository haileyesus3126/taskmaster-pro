
import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";

import AdminPanel from "./AdminPanel.jsx";

import {
  apiRequest,
  login,
  register,
  logout,
  getToken,
  getCurrentUser
} from "./auth.js";

import "./style.css";
import "./auth.css";

const STATUSES = [
  { value: "todo", label: "To Do" },
  { value: "in-progress", label: "In Progress" },
  { value: "done", label: "Completed" }
];

const EMPTY_TASK = {
  title: "",
  description: "",
  priority: "medium",
  status: "todo",
  dueDate: ""
};

function dateInput(value) {
  if (!value) return "";

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? ""
    : date.toISOString().slice(0, 10);
}

function displayDate(value) {
  if (!value) return "No due date";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Invalid date";
  }

  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC"
  });
}

function isOverdue(task) {
  if (!task.dueDate || task.status === "done") {
    return false;
  }

  return dateInput(task.dueDate) <
    new Date().toISOString().slice(0, 10);
}

function userId(user) {
  return String(user?.id || user?._id || "");
}

function taskOwnerId(task) {
  return String(
    task.owner?._id || task.owner || ""
  );
}

function taskAssigneeId(task) {
  return String(
    task.assignedTo?._id || task.assignedTo || ""
  );
}

function canManageTask(user, task) {
  return (
    user.role === "ADMIN" ||
    taskOwnerId(task) === userId(user) ||
    (
      user.role === "SUPERVISOR" &&
      taskAssigneeId(task) === userId(user)
    )
  );
}

// ---------------------------------------
// AUTHENTICATION SCREEN
// ---------------------------------------

function AuthScreen({ onAuthenticated }) {
  const [mode, setMode] = useState("login");

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: ""
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function update(field, value) {
    setForm(previous => ({
      ...previous,
      [field]: value
    }));
  }

  async function submit(event) {
    event.preventDefault();

    setError("");
    setLoading(true);

    try {
      let user;

      if (mode === "register") {
        user = await register(
          form.name,
          form.email,
          form.password
        );
      } else {
        user = await login(
          form.email,
          form.password
        );
      }

      onAuthenticated(user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function switchMode() {
    setMode(previous =>
      previous === "login"
        ? "register"
        : "login"
    );

    setError("");

    setForm(previous => ({
      ...previous,
      password: ""
    }));
  }

  return (
    <div className="auth-page">
      <section className="auth-showcase">
        <div className="auth-brand">
          <span className="auth-brand-icon">◆</span>
          TaskMaster Pro
        </div>

        <div className="auth-showcase-content">
          <h1>
            Organize your work.
            <br />
            <span>Achieve more.</span>
          </h1>

          <p>
            A smarter workspace for planning tasks,
            tracking progress, and staying productive.
          </p>

          <div className="auth-feature-list">
            {[
              "Manage your tasks efficiently",
              "Track progress in real time",
              "Stay organized with Kanban boards"
            ].map(item => (
              <div
                className="auth-feature"
                key={item}
              >
                <span className="auth-feature-icon">
                  ✓
                </span>
                {item}
              </div>
            ))}
          </div>
        </div>

        <div className="auth-showcase-footer">
          TaskMaster Pro · React + Express + MongoDB
        </div>
      </section>

      <section className="auth-form-side">
        <div className="auth-card">
          <h2>
            {mode === "login"
              ? "Welcome back"
              : "Create your account"}
          </h2>

          <p className="auth-subtitle">
            {mode === "login"
              ? "Sign in to access your workspace."
              : "Start organizing your tasks today."}
          </p>

          {error && (
            <div
              className="auth-error"
              role="alert"
            >
              {error}
            </div>
          )}

          <form
            className="auth-form"
            onSubmit={submit}
          >
            {mode === "register" && (
              <label>
                Full Name

                <input
                  type="text"
                  required
                  minLength={2}
                  maxLength={80}
                  autoComplete="name"
                  placeholder="Enter your full name"
                  value={form.name}
                  onChange={event =>
                    update(
                      "name",
                      event.target.value
                    )
                  }
                />
              </label>
            )}

            <label>
              Email Address

              <input
                type="email"
                required
                autoComplete="email"
                placeholder="you@example.com"
                value={form.email}
                onChange={event =>
                  update(
                    "email",
                    event.target.value
                  )
                }
              />
            </label>

            <label>
              Password

              <input
                type="password"
                required
                minLength={
                  mode === "register"
                    ? 8
                    : undefined
                }
                maxLength={128}
                autoComplete={
                  mode === "login"
                    ? "current-password"
                    : "new-password"
                }
                placeholder="Enter your password"
                value={form.password}
                onChange={event =>
                  update(
                    "password",
                    event.target.value
                  )
                }
              />
            </label>

            <button
              className="auth-submit"
              type="submit"
              disabled={loading}
            >
              {loading
                ? "Please wait..."
                : mode === "login"
                  ? "Sign In"
                  : "Create Account"}
            </button>
          </form>

          <div className="auth-switch">
            {mode === "login"
              ? "Don't have an account? "
              : "Already have an account? "}

            <button
              type="button"
              onClick={switchMode}
            >
              {mode === "login"
                ? "Sign up"
                : "Sign in"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

// ---------------------------------------
// TASK CREATE / EDIT MODAL
// ---------------------------------------

function TaskModal({
  task,
  onClose,
  onSave,
  saving
}) {
  const [form, setForm] = useState(
    task
      ? {
          title: task.title,
          description: task.description || "",
          priority: task.priority,
          status: task.status,
          dueDate: dateInput(task.dueDate)
        }
      : { ...EMPTY_TASK }
  );

  function update(field, value) {
    setForm(previous => ({
      ...previous,
      [field]: value
    }));
  }

  function submit(event) {
    event.preventDefault();

    if (!form.title.trim()) return;

    onSave(form, task?._id);
  }

  return (
    <div
      className="modal-backdrop"
      onMouseDown={event => {
        if (
          event.target === event.currentTarget
        ) {
          onClose();
        }
      }}
    >
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-modal-title"
      >
        <div className="modal-heading">
          <div>
            <h2 id="task-modal-title">
              {task
                ? "Edit Task"
                : "Create New Task"}
            </h2>

            <p>
              Organize your work effectively.
            </p>
          </div>

          <button
            className="icon-button"
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Close dialog"
          >
            ✕
          </button>
        </div>

        <form
          className="task-form"
          onSubmit={submit}
        >
          <label>
            Task Title

            <input
              autoFocus
              required
              maxLength={120}
              value={form.title}
              onChange={event =>
                update(
                  "title",
                  event.target.value
                )
              }
              placeholder="Enter task title"
            />
          </label>

          <label>
            Description

            <textarea
              rows={4}
              maxLength={1000}
              value={form.description}
              onChange={event =>
                update(
                  "description",
                  event.target.value
                )
              }
              placeholder="Describe your task"
            />
          </label>

          <div className="form-grid">
            <label>
              Priority

              <select
                value={form.priority}
                onChange={event =>
                  update(
                    "priority",
                    event.target.value
                  )
                }
              >
                <option value="low">
                  Low
                </option>

                <option value="medium">
                  Medium
                </option>

                <option value="high">
                  High
                </option>
              </select>
            </label>

            <label>
              Status

              <select
                value={form.status}
                onChange={event =>
                  update(
                    "status",
                    event.target.value
                  )
                }
              >
                {STATUSES.map(status => (
                  <option
                    key={status.value}
                    value={status.value}
                  >
                    {status.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label>
            Due Date

            <input
              type="date"
              value={form.dueDate}
              onChange={event =>
                update(
                  "dueDate",
                  event.target.value
                )
              }
            />
          </label>

          <div className="modal-footer">
            <button
              type="button"
              className="btn secondary"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="btn primary"
              disabled={saving}
            >
              {saving
                ? "Saving..."
                : task
                  ? "Save Changes"
                  : "Create Task"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------
// TASK CARD
// ---------------------------------------

function TaskCard({
  task,
  user,
  onEdit,
  onDelete,
  onStatusChange,
  busy
}) {
  const canManage = canManageTask(
    user,
    task
  );

  return (
    <article className="task-card">
      <div className="task-card-top">
        <div>
          <h3>{task.title}</h3>

          {task.description && (
            <p>{task.description}</p>
          )}
        </div>

        <span
          className={`priority ${task.priority}`}
        >
          {task.priority}
        </span>
      </div>

      <div className="task-meta">
        <span
          className={
            isOverdue(task)
              ? "overdue"
              : ""
          }
        >
          {displayDate(task.dueDate)}

          {isOverdue(task)
            ? " · Overdue"
            : ""}
        </span>

        <span
          className={`status-tag ${task.status}`}
        >
          {STATUSES.find(
            status =>
              status.value === task.status
          )?.label}
        </span>
      </div>

      <div className="task-actions">
        <select
          value={task.status}
          disabled={busy}
          aria-label={`Status for ${task.title}`}
          onChange={event =>
            onStatusChange(
              task,
              event.target.value
            )
          }
        >
          {STATUSES.map(status => (
            <option
              key={status.value}
              value={status.value}
            >
              {status.label}
            </option>
          ))}
        </select>

        {canManage && (
          <>
            <button
              className="icon-button"
              type="button"
              title="Edit task"
              aria-label={`Edit ${task.title}`}
              onClick={() => onEdit(task)}
              disabled={busy}
            >
              ✎
            </button>

            <button
              className="icon-button danger"
              type="button"
              title="Delete task"
              aria-label={`Delete ${task.title}`}
              onClick={() => onDelete(task)}
              disabled={busy}
            >
              🗑
            </button>
          </>
        )}
      </div>
    </article>
  );
}

// ---------------------------------------
// MAIN DASHBOARD
// ---------------------------------------

function Dashboard({
  user,
  onLogout
}) {
  const [tasks, setTasks] = useState([]);

  const [view, setView] = useState(
    "overview"
  );

  const [query, setQuery] = useState("");
  const [priority, setPriority] = useState("all");
  const [sort, setSort] = useState("newest");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const [mobileMenu, setMobileMenu] = useState(false);

  async function loadTasks() {
    setLoading(true);
    setError("");

    try {
      const data = await apiRequest(
        "/tasks"
      );

      setTasks(data);
    } catch (err) {
      if (err.status === 401) {
        onLogout();
        return;
      }

      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTasks();
  }, []);

  const stats = useMemo(() => {
    return {
      total: tasks.length,

      todo: tasks.filter(
        task => task.status === "todo"
      ).length,

      progress: tasks.filter(
        task => task.status === "in-progress"
      ).length,

      done: tasks.filter(
        task => task.status === "done"
      ).length,

      overdue: tasks.filter(
        isOverdue
      ).length
    };
  }, [tasks]);

  const completion = stats.total
    ? Math.round(
        (stats.done / stats.total) * 100
      )
    : 0;

  const filtered = useMemo(() => {
    const result = tasks.filter(task => {
      const searchText = (
        task.title +
        " " +
        (task.description || "")
      ).toLowerCase();

      const matchesSearch =
        searchText.includes(
          query.toLowerCase()
        );

      const matchesPriority =
        priority === "all" ||
        task.priority === priority;

      const matchesStatus =
        ![
          "todo",
          "in-progress",
          "done"
        ].includes(view) ||
        task.status === view;

      return (
        matchesSearch &&
        matchesPriority &&
        matchesStatus
      );
    });

    return [...result].sort((a, b) => {
      if (sort === "oldest") {
        return (
          new Date(a.createdAt) -
          new Date(b.createdAt)
        );
      }

      if (sort === "priority") {
        const rank = {
          high: 3,
          medium: 2,
          low: 1
        };

        return (
          rank[b.priority] -
          rank[a.priority]
        );
      }

      if (sort === "due") {
        const aDate = a.dueDate
          ? new Date(a.dueDate).getTime()
          : Infinity;

        const bDate = b.dueDate
          ? new Date(b.dueDate).getTime()
          : Infinity;

        return aDate - bDate;
      }

      return (
        new Date(b.createdAt) -
        new Date(a.createdAt)
      );
    });
  }, [
    tasks,
    query,
    priority,
    sort,
    view
  ]);

  async function saveTask(form, id) {
    setSaving(true);
    setError("");

    try {
      const payload = {
        ...form,
        title: form.title.trim(),
        dueDate: form.dueDate || null
      };

      const saved = await apiRequest(
        id
          ? `/tasks/${id}`
          : "/tasks",
        {
          method: id
            ? "PATCH"
            : "POST",

          body: JSON.stringify(payload)
        }
      );

      setTasks(previous =>
        id
          ? previous.map(task =>
              task._id === id
                ? saved
                : task
            )
          : [saved, ...previous]
      );

      setModalOpen(false);
      setEditing(null);

      setNotice(
        id
          ? "Task updated successfully."
          : "Task created successfully."
      );
    } catch (err) {
      if (err.status === 401) {
        onLogout();
        return;
      }

      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(
    task,
    status
  ) {
    setBusyId(task._id);
    setError("");

    try {
      const saved = await apiRequest(
        `/tasks/${task._id}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            status
          })
        }
      );

      setTasks(previous =>
        previous.map(item =>
          item._id === saved._id
            ? saved
            : item
        )
      );
    } catch (err) {
      if (err.status === 401) {
        onLogout();
        return;
      }

      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function deleteTask(task) {
    const confirmed = window.confirm(
      `Delete "${task.title}"?`
    );

    if (!confirmed) return;

    setBusyId(task._id);
    setError("");

    try {
      await apiRequest(
        `/tasks/${task._id}`,
        {
          method: "DELETE"
        }
      );

      setTasks(previous =>
        previous.filter(
          item =>
            item._id !== task._id
        )
      );

      setNotice(
        "Task deleted successfully."
      );
    } catch (err) {
      if (err.status === 401) {
        onLogout();
        return;
      }

      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  // -------------------------------------
  // SIDEBAR NAVIGATION
  // -------------------------------------

  const navigation = [
    ["overview", "◫", "Overview"],
    ["all", "☷", "All Tasks"],
    ["board", "▥", "Kanban Board"],
    ["todo", "◷", "To Do"],
    ["in-progress", "↗", "In Progress"],
    ["done", "✓", "Completed"]
  ];

  if (user.role === "ADMIN") {
    navigation.push([
      "admin",
      "⚙",
      "Admin Panel"
    ]);
  }

  // -------------------------------------
  // PAGE TITLES
  // -------------------------------------

  const titles = {
    overview: "Dashboard Overview",
    all: "All Tasks",
    board: "Kanban Board",
    todo: "To Do Tasks",
    "in-progress": "In Progress",
    done: "Completed Tasks",
    admin: "Admin Dashboard"
  };

  const initials = user.name
    .split(" ")
    .map(part => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="app-shell">
      {/* SIDEBAR */}

      <div
        className={`sidebar-wrap ${
          mobileMenu ? "show" : ""
        }`}
      >
        <aside className="sidebar">
          <div className="brand">
            <div className="brand-mark">
              ◆
            </div>

            <div>
              TaskMaster <span>PRO</span>
            </div>

            <button
              className="mobile-close"
              onClick={() =>
                setMobileMenu(false)
              }
            >
              ✕
            </button>
          </div>

          <div className="sidebar-section">
            WORKSPACE
          </div>

          <nav aria-label="Main navigation">
            {navigation.map(
              ([id, icon, label]) => (
                <button
                  key={id}
                  className={`nav-link ${
                    view === id
                      ? "active"
                      : ""
                  }`}
                  onClick={() => {
                    setView(id);
                    setMobileMenu(false);

                    if (id !== "admin") {
                      loadTasks();
                    }
                  }}
                >
                  <span
                    style={{
                      fontSize: 20,
                      width: 22
                    }}
                  >
                    {icon}
                  </span>

                  {label}
                </button>
              )
            )}
          </nav>

          <div className="sidebar-bottom">
            <div className="sidebar-avatar">
              {initials}
            </div>

            <div
              style={{
                flex: 1,
                minWidth: 0
              }}
            >
              <strong>
                {user.name}
              </strong>

              <small>
                {user.role}
              </small>
            </div>

            <button
              className="icon-button"
              title="Logout"
              aria-label="Logout"
              onClick={onLogout}
            >
              ↪
            </button>
          </div>
        </aside>
      </div>

      {mobileMenu && (
        <div
          className="mobile-overlay"
          onClick={() =>
            setMobileMenu(false)
          }
        />
      )}

      {/* MAIN CONTENT */}

      <main className="main-content">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="mobile-menu-button"
              onClick={() =>
                setMobileMenu(true)
              }
            >
              ☰
            </button>

            <span className="breadcrumb">
              WORKSPACE / {view.toUpperCase()}
            </span>
          </div>

          <div className="user-chip">
            <span className="online-dot" />

            {user.name}

            <div className="user-avatar">
              {initials}
            </div>
          </div>
        </header>

        <div className="page-content">
          {/* ADMIN PANEL */}

          {view === "admin" &&
          user.role === "ADMIN" ? (
            <AdminPanel
              onUnauthorized={onLogout}
            />
          ) : (
            <>
              {/* PAGE HEADING */}

              <div className="page-heading">
                <div>
                  <h1>
                    {titles[view]}
                  </h1>

                  <p>
                    Welcome back, {user.name}.
                    Let's make progress today.
                  </p>
                </div>

                <button
                  className="btn primary"
                  onClick={() => {
                    setEditing(null);
                    setModalOpen(true);
                  }}
                >
                  + New Task
                </button>
              </div>

              {/* ALERTS */}

              {error && (
                <div
                  className="alert error"
                  role="alert"
                >
                  {error}

                  <button
                    onClick={() =>
                      setError("")
                    }
                  >
                    ✕
                  </button>
                </div>
              )}

              {notice && (
                <div
                  className="alert success"
                  role="status"
                >
                  {notice}

                  <button
                    onClick={() =>
                      setNotice("")
                    }
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* STATISTICS */}

              <section className="stats-grid">
                {[
                  [
                    "Total Tasks",
                    stats.total,
                    "blue"
                  ],
                  [
                    "To Do",
                    stats.todo,
                    "orange"
                  ],
                  [
                    "In Progress",
                    stats.progress,
                    "purple"
                  ],
                  [
                    "Completed",
                    stats.done,
                    "green"
                  ]
                ].map(
                  ([label, value, tone]) => (
                    <div
                      className="stat-card"
                      key={label}
                    >
                      <div className="stat-top">
                        <span>
                          {label}
                        </span>

                        <span
                          className={`stat-icon ${tone}`}
                        >
                          ●
                        </span>
                      </div>

                      <strong>
                        {value}
                      </strong>

                      <small>
                        Your workspace statistics
                      </small>
                    </div>
                  )
                )}
              </section>

              {/* PROGRESS */}

              <section className="insights-grid">
                <div className="insight-card">
                  <div className="insight-heading">
                    <h2>
                      Overall Progress
                    </h2>

                    <strong>
                      {completion}%
                    </strong>
                  </div>

                  <p>
                    {stats.done} of{" "}
                    {stats.total} tasks completed
                  </p>

                  <div className="progress-track">
                    <div
                      className="progress-fill"
                      style={{
                        width: `${completion}%`
                      }}
                    />
                  </div>
                </div>

                <div className="insight-card overdue-card">
                  <span className="stat-icon orange">
                    !
                  </span>

                  <div>
                    <strong>
                      {stats.overdue} Overdue Tasks
                    </strong>

                    <p>
                      {stats.overdue
                        ? "Some tasks need your attention."
                        : "You're all caught up on deadlines."}
                    </p>
                  </div>
                </div>
              </section>

              {/* TASK WORKSPACE */}

              <section className="workspace-panel">
                <div className="section-heading">
                  <h2>
                    {view === "board"
                      ? "Task Board"
                      : "Your Tasks"}
                  </h2>

                  <p>
                    {filtered.length} tasks
                    in this view
                  </p>
                </div>

                {/* FILTERS */}

                <div className="toolbar">
                  <div className="search-box">
                    <span>
                      ⌕
                    </span>

                    <input
                      placeholder="Search tasks..."
                      aria-label="Search tasks"
                      value={query}
                      onChange={event =>
                        setQuery(
                          event.target.value
                        )
                      }
                    />
                  </div>

                  <select
                    value={priority}
                    onChange={event =>
                      setPriority(
                        event.target.value
                      )
                    }
                    aria-label="Filter by priority"
                  >
                    <option value="all">
                      All Priorities
                    </option>

                    <option value="high">
                      High Priority
                    </option>

                    <option value="medium">
                      Medium Priority
                    </option>

                    <option value="low">
                      Low Priority
                    </option>
                  </select>

                  <select
                    value={sort}
                    onChange={event =>
                      setSort(
                        event.target.value
                      )
                    }
                    aria-label="Sort tasks"
                  >
                    <option value="newest">
                      Newest First
                    </option>

                    <option value="oldest">
                      Oldest First
                    </option>

                    <option value="priority">
                      Highest Priority
                    </option>

                    <option value="due">
                      Due Date
                    </option>
                  </select>

                  <button
                    className="btn secondary"
                    onClick={loadTasks}
                    disabled={loading}
                  >
                    Refresh
                  </button>
                </div>

                {/* TASKS OR KANBAN */}

                {loading ? (
                  <div className="empty-state">
                    Loading your tasks...
                  </div>
                ) : view === "board" ? (
                  <div className="kanban-grid">
                    {STATUSES.map(status => (
                      <div
                        className="kanban-column"
                        key={status.value}
                      >
                        <div className="kanban-heading">
                          <h3>
                            {status.label}
                          </h3>

                          <span>
                            {filtered.filter(
                              task =>
                                task.status ===
                                status.value
                            ).length}
                          </span>
                        </div>

                        <div className="kanban-tasks">
                          {filtered
                            .filter(
                              task =>
                                task.status ===
                                status.value
                            )
                            .map(task => (
                              <TaskCard
                                key={task._id}
                                task={task}
                                user={user}
                                busy={
                                  busyId === task._id
                                }
                                onEdit={task => {
                                  setEditing(task);
                                  setModalOpen(true);
                                }}
                                onDelete={
                                  deleteTask
                                }
                                onStatusChange={
                                  changeStatus
                                }
                              />
                            ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : filtered.length ? (
                  <div className="task-grid">
                    {filtered.map(task => (
                      <TaskCard
                        key={task._id}
                        task={task}
                        user={user}
                        busy={
                          busyId === task._id
                        }
                        onEdit={task => {
                          setEditing(task);
                          setModalOpen(true);
                        }}
                        onDelete={
                          deleteTask
                        }
                        onStatusChange={
                          changeStatus
                        }
                      />
                    ))}
                  </div>
                ) : (
                  <div className="empty-state">
                    <div className="empty-icon">
                      ☷
                    </div>

                    <h3>
                      No tasks found
                    </h3>

                    <p>
                      Create a task or adjust
                      your filters.
                    </p>

                    <button
                      className="btn primary"
                      onClick={() => {
                        setEditing(null);
                        setModalOpen(true);
                      }}
                    >
                      + Create Task
                    </button>
                  </div>
                )}
              </section>

              <footer className="footer">
                TaskMaster Pro · React +
                Express + MongoDB
              </footer>
            </>
          )}
        </div>
      </main>

      {/* CREATE / EDIT MODAL */}

      {modalOpen && (
        <TaskModal
          key={
            editing?._id || "new"
          }
          task={editing}
          saving={saving}
          onClose={() =>
            setModalOpen(false)
          }
          onSave={saveTask}
        />
      )}
    </div>
  );
}

// ---------------------------------------
// ROOT APPLICATION
// ---------------------------------------

function App() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let active = true;

    async function restoreSession() {
      if (!getToken()) {
        if (active) {
          setChecking(false);
        }

        return;
      }

      try {
        const currentUser =
          await getCurrentUser();

        if (active) {
          setUser(currentUser);
        }
      } catch (error) {
        if (error.status === 401) {
          logout();
        }
      } finally {
        if (active) {
          setChecking(false);
        }
      }
    }

    restoreSession();

    return () => {
      active = false;
    };
  }, []);

  function handleLogout() {
    logout();
    setUser(null);
  }

  if (checking) {
    return (
      <div className="auth-loading">
        Loading TaskMaster Pro...
      </div>
    );
  }

  if (!user) {
    return (
      <AuthScreen
        onAuthenticated={setUser}
      />
    );
  }

  return (
    <Dashboard
      key={userId(user)}
      user={user}
      onLogout={handleLogout}
    />
  );
}

createRoot(
  document.getElementById("root")
).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
