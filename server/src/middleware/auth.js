import jwt from "jsonwebtoken";
import { StatusCodes } from "http-status-codes";

export function authenticate(req, _res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    const error = new Error("Authentication required");
    error.statusCode = StatusCodes.UNAUTHORIZED;
    throw error;
  }

  const token = authHeader.split(" ")[1];

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: payload.sub, role: payload.role };
    next();
  } catch (err) {
    const error = new Error("Invalid or expired token");
    error.statusCode = StatusCodes.UNAUTHORIZED;
    throw error;
  }
}

export function authorizeRoles(...roles) {
  return (req, _res, next) => {
    if (!roles.includes(req.user?.role)) {
      const error = new Error("You are not allowed to perform this action");
      error.statusCode = StatusCodes.FORBIDDEN;
      throw error;
    }
    next();
  };
}

export function ensureSameUserOrAdmin(paramKey = "id") {
  return (req, _res, next) => {
    if (req.user?.role === "admin" || req.user?.id === req.params[paramKey]) {
      return next();
    }
    const error = new Error("You are not allowed to access this resource");
    error.statusCode = StatusCodes.FORBIDDEN;
    throw error;
  };
}

