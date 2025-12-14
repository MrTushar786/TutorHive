import { Router } from "express";
import { authenticate } from "../middleware/auth.js";
import passport from "passport";
import { getProfile, login, register, updateProfile, socialCallback } from "../controllers/auth.controller.js";

const router = Router();

router.post("/register", register);
router.post("/login", login);
router.get("/me", authenticate, getProfile);
router.get("/profile/:userId", authenticate, getProfile);
router.patch("/profile/:userId", authenticate, updateProfile);

// Social Login Routes
router.get("/google", passport.authenticate("google", { scope: ["profile", "email"] }));
router.get(
    "/google/callback",
    passport.authenticate("google", { session: false, failureRedirect: "/login" }),
    socialCallback
);



export default router;

