import mongoose from "mongoose";
import Message from "../models/Message.js";
import Conversation from "../models/Conversation.js";
import User from "../models/User.js";

export const getConversations = async (req, res) => {
    const userId = req.user.id;

    try {
        // Find conversations involving this user where they haven't hidden it
        const regex = new RegExp(userId);

        let conversations = await Conversation.find({
            conversationId: { $regex: regex },
            hiddenFor: { $ne: userId }
        })
            .sort({ updatedAt: -1 })
            .populate("participants", "name avatar");

        // Map to client format
        const formatted = conversations.map(conv => {
            const otherUser = conv.participants.find(p => p._id.toString() !== userId);
            if (!otherUser) return null;

            return {
                id: conv.conversationId,
                name: otherUser.name,
                avatar: otherUser.avatar,
                lastMessage: conv.lastMessage?.text || "No messages",
                lastMessageTime: conv.lastMessage?.createdAt,
                unreadCount: conv.unreadCounts?.get(userId) || 0
            };
        }).filter(Boolean);

        res.json(formatted);
    } catch (error) {
        console.error("Error fetching conversations:", error);
        res.status(500).json({ message: "Failed to fetch conversations" });
    }
};

export const markAsRead = async (req, res) => {
    const { conversationId } = req.body;
    const userId = req.user.id;

    try {
        // Update messages
        await Message.updateMany(
            {
                conversationId,
                sender: { $ne: userId },
                read: false
            },
            { $set: { read: true } }
        );

        // Update conversation unread count
        await Conversation.updateOne(
            { conversationId },
            { $set: { [`unreadCounts.${userId}`]: 0 } }
        );

        res.status(200).json({ success: true });
    } catch (error) {
        console.error("Error marking messages as read:", error);
        res.status(500).json({ message: "Failed to mark messages as read" });
    }
};

export const deleteConversation = async (req, res) => {
    const { conversationId } = req.params;
    const userId = req.user.id;

    console.log(`Deleting conversation ${conversationId} for user ${userId}`);

    try {
        // Hiding the conversation from the list view
        await Conversation.updateOne(
            { conversationId },
            { $addToSet: { hiddenFor: userId } }
        );

        res.status(200).json({ success: true });
    } catch (error) {
        console.error("Error deleting conversation:", error);
        res.status(500).json({ message: "Failed to delete conversation" });
    }
};
