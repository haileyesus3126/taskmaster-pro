
import "dotenv/config";

import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

import Task from "./models/Task.js";
import User from "./models/User.js";

import authRoutes from "./routes/authRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";

import {
  protect,
  authorize
} from "./middleware/auth.js";

const app = express();

const PORT = Number(process.env.PORT) || 5000;

const CLIENT_ORIGIN =
  process.env.CLIENT_ORIGIN ||
  "http://localhost:5173";

// ------------------------------------
// SECURITY AND MIDDLEWARE
// ------------------------------------

app.disable("x-powered-by");

app.use(helmet());

app.use(
  cors({
    origin: CLIENT_ORIGIN,
    methods: ["GET", "POST", "PATCH", "DELETE"],
    allowedHeaders: [
      "Content-Type",
      "Authorization"
    ]
  })
);

app.use(express.json({ limit: "100kb" }));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    error: "Too many requests. Try again later."
  }
});

// ------------------------------------
// HEALTH CHECK
// ------------------------------------

app.get("/api/health", (req, res) => {
  const connected =
    mongoose.connection.readyState === 1;

  res.status(connected ? 200 : 503).json({
    ok: connected,
    database: connected
      ? "connected"
      : "disconnected"
  });
});

// ------------------------------------
// AUTHENTICATION ROUTES
// ------------------------------------

app.use(
  "/api/auth",
  authLimiter,
  authRoutes
);

// ------------------------------------
// ADMIN ROUTES
// ------------------------------------

app.use("/api/admin", adminRoutes);

// ------------------------------------
// TASK ROUTES
// ------------------------------------

const taskRouter = express.Router();

taskRouter.use(protect);

const allowedStatuses = [
  "todo",
  "in-progress",
  "done"
];

const allowedPriorities = [
  "low",
  "medium",
  "high"
];

function isAdmin(user) {
  return user.role === "ADMIN";
}

function isSupervisor(user) {
  return user.role === "SUPERVISOR";
}

function canManageTask(user, task) {
  if (isAdmin(user)) {
    return true;
  }

  if (
    task.owner &&
    String(task.owner) === String(user._id)
  ) {
    return true;
  }

  if (
    isSupervisor(user) &&
    task.assignedTo &&
    String(task.assignedTo) === String(user._id)
  ) {
    return true;
  }

  return false;
}

function canViewTask(user, task) {
  if (canManageTask(user, task)) {
    return true;
  }

  return Boolean(
    task.assignedTo &&
    String(task.assignedTo) === String(user._id)
  );
}

function taskFilter(user) {
  if (isAdmin(user)) {
    return {};
  }

  return {
    $or: [
      { owner: user._id },
      { assignedTo: user._id }
    ]
  };
}

function validateTaskFields(body) {
  const errors = [];

  if (
    body.title !== undefined &&
    (
      typeof body.title !== "string" ||
      !body.title.trim() ||
      body.title.trim().length > 120
    )
  ) {
    errors.push("Invalid task title");
  }

  if (
    body.description !== undefined &&
    (
      typeof body.description !== "string" ||
      body.description.length > 1000
    )
  ) {
    errors.push("Invalid task description");
  }

  if (
    body.status !== undefined &&
    !allowedStatuses.includes(body.status)
  ) {
    errors.push("Invalid task status");
  }

  if (
    body.priority !== undefined &&
    !allowedPriorities.includes(body.priority)
  ) {
    errors.push("Invalid task priority");
  }

  if (
    body.dueDate !== undefined &&
    body.dueDate !== null &&
    body.dueDate !== "" &&
    Number.isNaN(
      new Date(body.dueDate).getTime()
    )
  ) {
    errors.push("Invalid due date");
  }

  return errors;
}

function taskPayload(body) {
  const payload = {};

  if (body.title !== undefined) {
    payload.title = body.title.trim();
  }

  if (body.description !== undefined) {
    payload.description = body.description;
  }

  if (body.status !== undefined) {
    payload.status = body.status;
  }

  if (body.priority !== undefined) {
    payload.priority = body.priority;
  }

  if (body.dueDate !== undefined) {
    payload.dueDate =
      body.dueDate ? new Date(body.dueDate) : null;
  }

  return payload;
}

// ------------------------------------
// GET ALL ACCESSIBLE TASKS
// ------------------------------------

taskRouter.get("/", async (req, res) => {
  try {
    const tasks = await Task.find(
      taskFilter(req.user)
    )
      .sort({ createdAt: -1 })
      .limit(500);

    res.json(tasks);
  } catch (error) {
    console.error("Get tasks error:", error);

    res.status(500).json({
      error: "Failed to load tasks"
    });
  }
});

// ------------------------------------
// GET SINGLE TASK
// ------------------------------------

taskRouter.get("/:id", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        error: "Invalid task ID"
      });
    }

    const task = await Task.findById(req.params.id);

    if (!task || !canViewTask(req.user, task)) {
      return res.status(404).json({
        error: "Task not found"
      });
    }

    res.json(task);
  } catch (error) {
    console.error("Get task error:", error);

    res.status(500).json({
      error: "Failed to load task"
    });
  }
});

// ------------------------------------
// CREATE TASK
// ------------------------------------

taskRouter.post("/", async (req, res) => {
  try {
    const errors = validateTaskFields(req.body);

    if (errors.length) {
      return res.status(400).json({
        error: errors.join(", ")
      });
    }

    if (!req.body.title) {
      return res.status(400).json({
        error: "Task title is required"
      });
    }

    const task = await Task.create({
      ...taskPayload(req.body),
      owner: req.user._id,
      assignedTo: req.user._id
    });

    res.status(201).json(task);
  } catch (error) {
    console.error("Create task error:", error);

    res.status(500).json({
      error: "Failed to create task"
    });
  }
});

// ------------------------------------
// UPDATE TASK
// ------------------------------------

taskRouter.patch("/:id", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        error: "Invalid task ID"
      });
    }

    const errors = validateTaskFields(req.body);

    if (errors.length) {
      return res.status(400).json({
        error: errors.join(", ")
      });
    }

    const task = await Task.findById(req.params.id);

    if (!task || !canViewTask(req.user, task)) {
      return res.status(404).json({
        error: "Task not found"
      });
    }

    const isAssignee =
      task.assignedTo &&
      String(task.assignedTo) ===
        String(req.user._id);

    if (
      !canManageTask(req.user, task) &&
      !isAssignee
    ) {
      return res.status(403).json({
        error: "You cannot update this task"
      });
    }

    const payload = taskPayload(req.body);

    // Assignees who do not own a task
    // may only update its status.
    if (
      !canManageTask(req.user, task) &&
      Object.keys(payload).some(
        field => field !== "status"
      )
    ) {
      return res.status(403).json({
        error: "You can only update task status"
      });
    }

    Object.assign(task, payload);

    await task.save();

    res.json(task);
  } catch (error) {
    console.error("Update task error:", error);

    res.status(500).json({
      error: "Failed to update task"
    });
  }
});

// ------------------------------------
// DELETE TASK
// ------------------------------------

taskRouter.delete("/:id", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        error: "Invalid task ID"
      });
    }

    const task = await Task.findById(req.params.id);

    if (!task || !canViewTask(req.user, task)) {
      return res.status(404).json({
        error: "Task not found"
      });
    }

    if (!canManageTask(req.user, task)) {
      return res.status(403).json({
        error: "You cannot delete this task"
      });
    }

    await task.deleteOne();

    res.json({
      message: "Task deleted successfully"
    });
  } catch (error) {
    console.error("Delete task error:", error);

    res.status(500).json({
      error: "Failed to delete task"
    });
  }
});

// ------------------------------------
// ASSIGN TASK TO USER
// ------------------------------------

taskRouter.patch(
  "/:id/assign",
  authorize("ADMIN", "SUPERVISOR"),
  async (req, res) => {
    try {
      if (!mongoose.isValidObjectId(req.params.id)) {
        return res.status(400).json({
          error: "Invalid task ID"
        });
      }

      const { userId } = req.body;

      if (!mongoose.isValidObjectId(userId)) {
        return res.status(400).json({
          error: "Invalid user ID"
        });
      }

      const task = await Task.findById(req.params.id);

      if (!task || !canManageTask(req.user, task)) {
        return res.status(404).json({
          error: "Task not found"
        });
      }

      const user = await User.findOne({
        _id: userId,
        isActive: { $ne: false }
      });

      if (!user) {
        return res.status(404).json({
          error: "Active user not found"
        });
      }

      task.assignedTo = user._id;

      await task.save();

      res.json({
        message: "Task assigned successfully",
        task
      });
    } catch (error) {
      console.error("Assign task error:", error);

      res.status(500).json({
        error: "Failed to assign task"
      });
    }
  }
);

// ------------------------------------
// GET USERS FOR TASK ASSIGNMENT
// ------------------------------------

taskRouter.get(
  "/meta/users",
  authorize("ADMIN", "SUPERVISOR"),
  async (req, res) => {
    try {
      const users = await User.find({
        isActive: { $ne: false }
      })
        .select("name email role")
        .sort({ name: 1 })
        .limit(200);

      res.json(users);
    } catch (error) {
      console.error("Load users error:", error);

      res.status(500).json({
        error: "Failed to load users"
      });
    }
  }
);

// ------------------------------------
// REGISTER TASK ROUTER
// ------------------------------------

app.use("/api/tasks", taskRouter);

// ------------------------------------
// UNKNOWN API ROUTES
// ------------------------------------

app.use((req, res) => {
  res.status(404).json({
    error: "API endpoint not found"
  });
});

// ------------------------------------
// GENERAL ERROR HANDLER
// ------------------------------------

app.use((error, req, res, next) => {
  console.error("Server error:", error);

  res.status(500).json({
    error: "Internal server error"
  });
});

// ------------------------------------
// CONNECT DATABASE AND START SERVER
// ------------------------------------

async function startServer() {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error(
        "MONGODB_URI is missing in .env"
      );
    }

    if (!process.env.JWT_SECRET) {
      throw new Error(
        "JWT_SECRET is missing in .env"
      );
    }

    await mongoose.connect(
      process.env.MONGODB_URI,
      {
        serverSelectionTimeoutMS: 15000
      }
    );

    console.log("MongoDB Atlas connected");

    app.listen(PORT, () => {
      console.log(
        `TaskMaster API running on port ${PORT}`
      );
    });
  } catch (error) {
    console.error(
      "Startup failed:",
      error.message
    );

    process.exit(1);
  }
}

startServer();
