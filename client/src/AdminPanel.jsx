
import React, { useEffect, useState } from "react";
import { apiRequest } from "./auth.js";
import "./admin.css";

export default function AdminPanel({ onUnauthorized }) {
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function loadData() {
    setLoading(true);
    setError("");

    try {
      const [statsData, usersData, tasksData] =
        await Promise.all([
          apiRequest("/admin/stats"),
          apiRequest("/admin/users"),
          apiRequest("/tasks")
        ]);

      setStats(statsData);
      setUsers(usersData);
      setTasks(tasksData);
    } catch (err) {
      setError(err.message);
      if (err.status === 401) onUnauthorized?.();
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function changeRole(userId, role) {
    setBusy(userId);
    setError("");
    setSuccess("");

    try {
      const updated = await apiRequest(
        `/admin/users/${userId}/role`,
        {
          method: "PATCH",
          body: JSON.stringify({ role })
        }
      );

      setUsers(previous =>
        previous.map(user =>
          user._id === userId ? updated : user
        )
      );

      setSuccess("User role updated successfully.");
    } catch (err) {
      setError(err.message);
      await loadData();
    } finally {
      setBusy("");
    }
  }

  async function assignTask(taskId) {
    const userId = selectedUsers[taskId];

    if (!userId) {
      setError("Please select a user first.");
      return;
    }

    setBusy(taskId);
    setError("");
    setSuccess("");

    try {
      await apiRequest(`/tasks/${taskId}/assign`, {
        method: "PATCH",
        body: JSON.stringify({ userId })
      });

      setSuccess("Task assigned successfully.");

      const updatedTasks = await apiRequest("/tasks");
      setTasks(updatedTasks);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  }

  function getAssignedUser(task) {
    const id =
      typeof task.assignedTo === "object"
        ? task.assignedTo?._id
        : task.assignedTo;

    return users.find(user => user._id === id);
  }

  if (loading) {
    return <div className="admin-loading">Loading admin data...</div>;
  }

  return (
    <div className="admin-page">
      <div className="admin-heading">
        <div>
          <h1>Admin Dashboard</h1>
          <p>Manage your workspace, users, and tasks.</p>
        </div>

        <button
          className="admin-button"
          onClick={loadData}
        >
          Refresh Data
        </button>
      </div>

      {error && (
        <div className="admin-alert error" role="alert">
          {error}
        </div>
      )}

      {success && (
        <div className="admin-alert success" role="status">
          {success}
        </div>
      )}

      {stats && (
        <div className="admin-stats">
          {[
            ["Total Users", stats.totalUsers],
            ["Administrators", stats.admins],
            ["Supervisors", stats.supervisors],
            ["Total Tasks", stats.totalTasks],
            ["Completed", stats.completedTasks],
            ["Pending", stats.pendingTasks]
          ].map(([label, value]) => (
            <div className="admin-stat" key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </div>
      )}

      <section className="admin-section">
        <div className="admin-section-header">
          <h2>User Management</h2>
          <span>{users.length} users shown</span>
        </div>

        <div className="admin-table-scroll">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
              </tr>
            </thead>

            <tbody>
              {users.map(user => (
                <tr key={user._id}>
                  <td>{user.name}</td>
                  <td>{user.email}</td>
                  <td>
                    <select
                      value={user.role}
                      disabled={busy === user._id}
                      onChange={event =>
                        changeRole(
                          user._id,
                          event.target.value
                        )
                      }
                    >
                      <option value="USER">User</option>
                      <option value="SUPERVISOR">
                        Supervisor
                      </option>
                      <option value="ADMIN">Admin</option>
                    </select>
                  </td>
                  <td>
                    <span className={
                      user.isActive === false
                        ? "admin-status inactive"
                        : "admin-status active"
                    }>
                      {user.isActive === false
                        ? "Inactive"
                        : "Active"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="admin-section">
        <div className="admin-section-header">
          <h2>Task Assignment</h2>
          <span>{tasks.length} tasks shown</span>
        </div>

        <div className="admin-table-scroll">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Task</th>
                <th>Status</th>
                <th>Assigned To</th>
                <th>Assign User</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {tasks.map(task => (
                <tr key={task._id}>
                  <td>{task.title}</td>
                  <td>{task.status}</td>
                  <td>
                    {getAssignedUser(task)?.name ||
                      "Unassigned"}
                  </td>
                  <td>
                    <select
                      value={selectedUsers[task._id] || ""}
                      onChange={event =>
                        setSelectedUsers(previous => ({
                          ...previous,
                          [task._id]: event.target.value
                        }))
                      }
                    >
                      <option value="">
                        Select user
                      </option>

                      {users
                        .filter(user => user.isActive !== false)
                        .map(user => (
                          <option
                            key={user._id}
                            value={user._id}
                          >
                            {user.name} ({user.role})
                          </option>
                        ))}
                    </select>
                  </td>
                  <td>
                    <button
                      className="admin-button"
                      disabled={busy === task._id}
                      onClick={() => assignTask(task._id)}
                    >
                      {busy === task._id
                        ? "Saving..."
                        : "Assign"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
