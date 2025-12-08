import mongoose from "mongoose";
import Message from "../models/Message.js";
import User from "../models/User.js";

export const getConversations = async (req, res) => {
    const userId = req.user.id;

    try {
        // Find all messages where the conversationId contains the userId
        // Note: This relies on the conversationId format "conv-<a>-<b>"
        const regex = new RegExp(userId);

        const conversations = await Message.aggregate([
            {
                $match: {
                    conversationId: { $regex: regex }
                }
            },
            {
                $sort: { createdAt: -1 }
            },
            {
                $group: {
                    _id: "$conversationId",
                    lastMessage: { $first: "$$ROOT" },
                    unreadCount: {
                        $sum: {
                            $cond: [
                                { $and: [{ $ne: ["$sender", new mongoose.Types.ObjectId(userId)] }, { $eq: ["$read", false] }] },
                                1,
                                0
                            ]
                        }
                    }
                }
            }
        ]);

        // Now populate the other user's info
        const populatedConversations = await Promise.all(conversations.map(async (conv) => {
            const parts = conv._id.split("-");
            // parts[0] is "conv"
            // parts[1] and parts[2] are user IDs
            const otherUserId = parts[1] === userId ? parts[2] : parts[1];

            const otherUser = await User.findById(otherUserId).select("name avatar");

            if (!otherUser) return null;

            return {
                id: conv._id,
                name: otherUser.name,
                avatar: otherUser.avatar,
                lastMessage: conv.lastMessage.text,
                lastMessageTime: conv.lastMessage.createdAt,
                unreadCount: conv.unreadCount
            };
        }));

        res.json(populatedConversations.filter(Boolean));
    } catch (error) {
        console.error("Error fetching conversations:", error);
        res.status(500).json({ message: "Failed to fetch conversations" });
    }
};
