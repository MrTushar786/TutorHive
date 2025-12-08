import { Router } from "express";
import { authenticate } from "../middleware/auth.js";
import { getDashboard } from "../controllers/student.controller.js";

const router = Router();

router.get("/:studentId/dashboard", authenticate, getDashboard);

export default router;

