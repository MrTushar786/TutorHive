import express from "express";
import { getConversations, markAsRead, deleteConversation } from "../controllers/messageController.js";
import { authenticate } from "../middleware/auth.js";

const router = express.Router();

router.get("/conversations", authenticate, getConversations);
router.post("/mark-read", authenticate, markAsRead);
router.delete("/conversations/:conversationId", authenticate, deleteConversation);

export default router;
