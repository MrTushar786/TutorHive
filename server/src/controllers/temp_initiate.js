
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
