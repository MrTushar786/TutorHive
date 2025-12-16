import express from "express";
import { getConversations, markAsRead, deleteConversation, editMessage, deleteMessage } from "../controllers/messageController.js";
import { authenticate } from "../middleware/auth.js";

const router = express.Router();

router.get("/conversations", authenticate, getConversations);
router.post("/mark-read", authenticate, markAsRead);
router.delete("/conversations/:conversationId", authenticate, deleteConversation);
router.patch("/:messageId", authenticate, editMessage);
router.delete("/:messageId", authenticate, deleteMessage);

export default router;
