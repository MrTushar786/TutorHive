import express from "express";
import { getConversations } from "../controllers/messageController.js";
import { authenticate } from "../middleware/auth.js";

const router = express.Router();

router.get("/conversations", authenticate, getConversations);

export default router;
