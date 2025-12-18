import mongoose from "mongoose";
import Message from "../models/Message.js";
import Conversation from "../models/Conversation.js";
import User from "../models/User.js";

export const getConversations = async (req, res) => {
    const userId = req.user.id;

    try {
        const userObjectId = new mongoose.Types.ObjectId(userId);

        // Find conversations involving this user where they aren't in the hiddenFor list
        let conversations = await Conversation.find({
            participants: userObjectId,
            hiddenFor: { $ne: userObjectId }
        })
            .sort({ updatedAt: -1 })
            .populate("participants", "name avatar");

        // Map to client format and deduplicate by partner ID
        const seenPartners = new Set();
        const formatted = [];

        for (const conv of conversations) {
            // Find the other participant
            const otherUser = conv.participants.find(p => p._id.toString() !== userId);

            // If no other user (e.g. self-chat or data error), skip or handle gracefully
            if (!otherUser) continue;

            const partnerId = otherUser._id.toString();

            // Deduplication: If we've already seen a chat with this partner, skip this one.
            // Since we sort by updatedAt: -1, we keep the most recent one.
            if (seenPartners.has(partnerId)) continue;
            seenPartners.add(partnerId);

            let lastMsgText = conv.lastMessage?.text || "No messages";
            let lastMsgTime = conv.lastMessage?.createdAt;

            // Check if history was cleared after the last message
            const clearTime = conv.clearedHistoryAt?.get(userId);
            if (clearTime && lastMsgTime && new Date(lastMsgTime) <= new Date(clearTime)) {
                lastMsgText = "";
                lastMsgTime = null;
            }

            // Only push if there's a valid partner
            formatted.push({
                id: conv.conversationId,
                conversationId: conv.conversationId, // redundancy for safety
                name: otherUser.name,
                avatar: otherUser.avatar,
                partnerId: partnerId,
                lastMessage: lastMsgText,
                lastMessageTime: lastMsgTime,
                unreadCount: conv.unreadCounts?.get(userId) || 0
            });
        }

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
        // Hiding the conversation from the list view and marking history as cleared
        await Conversation.updateOne(
            { conversationId },
            {
                $addToSet: { hiddenFor: userId },
                $set: { [`clearedHistoryAt.${userId}`]: new Date() }
            }
        );

        // Soft delete all messages in this conversation for this user
        // so history is cleared if they return.
        await Message.updateMany(
            { conversationId },
            { $addToSet: { deletedBy: new mongoose.Types.ObjectId(userId) } }
        );

        res.status(200).json({ success: true });
    } catch (error) {
        console.error("Error deleting conversation:", error);
        res.status(500).json({ message: "Failed to delete conversation" });
    }
};

export const editMessage = async (req, res) => {
    const { messageId } = req.params;
    const { text } = req.body;
    const userId = req.user.id;

    try {
        const message = await Message.findById(messageId);
        if (!message) {
            return res.status(404).json({ message: "Message not found" });
        }

        if (message.sender.toString() !== userId) {
            return res.status(403).json({ message: "Not authorized to edit this message" });
        }

        message.text = text;
        message.isEdited = true;
        await message.save();

        res.json({ success: true, message });
    } catch (error) {
        console.error("Error editing message:", error);
        res.status(500).json({ message: "Failed to edit message" });
    }
};

export const deleteMessage = async (req, res) => {
    const { messageId } = req.params;
    const { mode } = req.query; // 'everyone' or 'me'
    const userId = req.user.id;

    try {
        const message = await Message.findById(messageId);
        if (!message) {
            return res.status(404).json({ message: "Message not found" });
        }

        if (mode === 'everyone') {
            if (message.sender.toString() !== userId) {
                return res.status(403).json({ message: "Not authorized to delete this message for everyone" });
            }
            message.isDeleted = true;
            message.text = "This message was deleted";
            await message.save();
        } else {
            // Delete for me
            if (!message.deletedBy.includes(userId)) {
                message.deletedBy.push(userId);
                await message.save();
            }
        }

        res.json({ success: true, messageId });
    } catch (error) {
        console.error("Error deleting message:", error);
        res.status(500).json({ message: "Failed to delete message" });
    }
};

export const initiateConversation = async (req, res) => {
    const { targetUserId } = req.body;
    const userId = req.user.id;

    if (!targetUserId) {
        return res.status(400).json({ message: "Target user ID is required" });
    }

    try {
        const sortedIds = [userId, targetUserId].sort();
        const conversationId = sortedIds.join("-");

        // Use findOneAndUpdate to atomically create or update
        // We ensure 'hiddenFor' does NOT contain the current user
        let conversation = await Conversation.findOneAndUpdate(
            { conversationId },
            {
                $setOnInsert: {
                    conversationId,
                    participants: [userId, targetUserId],
                    unreadCounts: { [userId]: 0, [targetUserId]: 0 }
                },
                $pull: { hiddenFor: userId } // IMPORTANT: Unhide if it was hidden
            },
            { new: true, upsert: true, setDefaultsOnInsert: true }
        ).populate("participants", "name avatar");

        // Format for client
        const otherUser = conversation.participants.find(p => p._id.toString() !== userId);

        const formatted = {
            id: conversation.conversationId,
            name: otherUser ? otherUser.name : "Unknown User",
            avatar: otherUser ? otherUser.avatar : "",
            lastMessage: conversation.lastMessage?.text || "No messages",
            lastMessageTime: conversation.lastMessage?.createdAt,
            unreadCount: conversation.unreadCounts?.get(userId) || 0
        };

        res.json(formatted);
    } catch (error) {
        console.error("Error initiating conversation:", error);
        res.status(500).json({ message: "Failed to initiate conversation" });
    }
};
