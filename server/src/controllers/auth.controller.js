import { StatusCodes } from "http-status-codes";
import User from "../models/User.js";
import { createAuthToken } from "../utils/token.js";
import { loginSchema, registerSchema } from "../validation/auth.schema.js";

export async function register(req, res) {
  const payload = registerSchema.parse(req.body);

  if (payload.password !== payload.confirmPassword) {
    return res.status(StatusCodes.BAD_REQUEST).json({ message: "Passwords do not match" });
  }

  const existing = await User.findOne({ email: payload.email });
  if (existing) {
    return res.status(StatusCodes.CONFLICT).json({ message: "Email already registered" });
  }

  const user = await User.create({
    name: payload.name,
    email: payload.email,
    password: payload.password,
    role: payload.role,
    subjects: payload.subjects,
    hourlyRate: payload.hourlyRate,
    expertise: payload.expertise,
    availability: payload.availability,
    stats: {},
  });

  const token = createAuthToken(user);

  res.status(StatusCodes.CREATED).json({
    user,
    token,
  });
}

export async function login(req, res) {
  const payload = loginSchema.parse(req.body);

  const user = await User.findOne({ email: payload.email });
  if (!user) {
    return res.status(StatusCodes.UNAUTHORIZED).json({ message: "Invalid credentials" });
  }

  const isMatch = await user.comparePassword(payload.password);
  if (!isMatch) {
    return res.status(StatusCodes.UNAUTHORIZED).json({ message: "Invalid credentials" });
  }

  const token = createAuthToken(user);

  res.json({
    user,
    token,
  });
}

export async function getProfile(req, res) {
  const { userId } = req.params;
  const targetUserId = userId || req.user.id;
  
  // Users can only view their own profile unless admin
  if (req.user.role !== "admin" && req.user.id !== targetUserId) {
    return res.status(StatusCodes.FORBIDDEN).json({ message: "Not authorized" });
  }

  const user = await User.findById(targetUserId);
  if (!user) {
    return res.status(StatusCodes.NOT_FOUND).json({ message: "User not found" });
  }
  res.json({ user });
}

export async function updateProfile(req, res) {
  const { userId } = req.params;
  const targetUserId = userId || req.user.id;
  
  // Users can only update their own profile unless admin
  if (req.user.role !== "admin" && req.user.id !== targetUserId) {
    return res.status(StatusCodes.FORBIDDEN).json({ message: "Not authorized" });
  }

  const user = await User.findById(targetUserId);
  if (!user) {
    return res.status(StatusCodes.NOT_FOUND).json({ message: "User not found" });
  }

  // Update allowed fields
  const allowedFields = ["name", "avatar", "bio", "subjects", "hourlyRate", "expertise", "availability"];
  allowedFields.forEach((field) => {
    if (req.body[field] !== undefined) {
      user[field] = req.body[field];
    }
  });

  await user.save();

  res.json({ user });
}

