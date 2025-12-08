import { Router } from "express";
import { authenticate } from "../middleware/auth.js";
import { getProfile, login, register, updateProfile } from "../controllers/auth.controller.js";

const router = Router();

router.post("/register", register);
router.post("/login", login);
router.get("/me", authenticate, getProfile);
router.get("/profile/:userId", authenticate, getProfile);
router.patch("/profile/:userId", authenticate, updateProfile);

export default router;

