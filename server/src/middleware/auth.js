
import jwt from "jsonwebtoken";
import User from "../models/User.js";

export async function protect(req, res, next) {
  try {
    const authorization =
      req.headers.authorization || "";

    if (!authorization.startsWith("Bearer ")) {
      return res.status(401).json({
        error: "Authentication required"
      });
    }

    const token = authorization.slice(7);

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET,
      {
        algorithms: ["HS256"]
      }
    );

    const user = await User.findById(
      decoded.id
    ).select("-password");

    if (!user) {
      return res.status(401).json({
        error: "User account not found"
      });
    }

    if (user.isActive === false) {
      return res.status(403).json({
        error: "Your account is deactivated"
      });
    }

    req.user = user;

    next();
  } catch {
    return res.status(401).json({
      error: "Invalid or expired authentication token"
    });
  }
}

export function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (
      !req.user ||
      !allowedRoles.includes(req.user.role)
    ) {
      return res.status(403).json({
        error: "You do not have permission"
      });
    }

    next();
  };
}
