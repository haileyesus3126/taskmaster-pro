
import { Router } from "express";
import mongoose from "mongoose";

import User from "../models/User.js";
import Task from "../models/Task.js";

import {
  protect,
  authorize
} from "../middleware/auth.js";

const router = Router();

router.use(protect);
router.use(authorize("ADMIN"));

// GET /api/admin/stats
router.get("/stats", async (req, res) => {
  try {
    const [
      totalUsers,
      admins,
      supervisors,
      totalTasks,
      completedTasks
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ role: "ADMIN" }),
      User.countDocuments({ role: "SUPERVISOR" }),
      Task.countDocuments(),
      Task.countDocuments({ status: "done" })
    ]);

    res.json({
      totalUsers,
      admins,
      supervisors,
      totalTasks,
      completedTasks,
      pendingTasks: totalTasks - completedTasks
    });
  } catch {
    res.status(500).json({
      error: "Failed to load admin statistics"
    });
  }
});

// GET /api/admin/users
router.get("/users", async (req, res) => {
  try {
    const users = await User.find()
      .select("name email role isActive createdAt")
      .sort({ createdAt: -1 })
      .limit(200);

    res.json(users);
  } catch {
    res.status(500).json({
      error: "Failed to load users"
    });
  }
});

// PATCH /api/admin/users/:id/role
router.patch(
  "/users/:id/role",
  async (req, res) => {
    try {
      const { role } = req.body;

      if (
        !["ADMIN", "SUPERVISOR", "USER"].includes(role)
      ) {
        return res.status(400).json({
          error: "Invalid role"
        });
      }

      if (!mongoose.isValidObjectId(req.params.id)) {
        return res.status(400).json({
          error: "Invalid user ID"
        });
      }

      if (req.params.id === req.user.id) {
        return res.status(400).json({
          error: "You cannot change your own role"
        });
      }

      const user = await User.findByIdAndUpdate(
        req.params.id,
        { role },
        {
          new: true,
          runValidators: true
        }
      ).select("name email role isActive");

      if (!user) {
        return res.status(404).json({
          error: "User not found"
        });
      }

      res.json(user);
    } catch {
      res.status(500).json({
        error: "Failed to update user role"
      });
    }
  }
);

export default router;
