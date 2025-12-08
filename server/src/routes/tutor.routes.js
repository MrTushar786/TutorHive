import { Router } from "express";
import { authenticate } from "../middleware/auth.js";
import { getDashboard, listTutors } from "../controllers/tutor.controller.js";

const router = Router();

router.get("/", authenticate, listTutors);
router.get("/:tutorId/dashboard", authenticate, getDashboard);

export default router;

