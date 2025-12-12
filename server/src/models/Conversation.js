import mongoose from "mongoose";

const conversationSchema = new mongoose.Schema({
    conversationId: {
        type: String,
        required: true,
        unique: true,
        index: true,
    },
    participants: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
    }],
    lastMessage: {
        text: String,
        sender: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        createdAt: Date,
    },
    unreadCounts: {
        type: Map,
        of: Number,
        default: {}
    },
    hiddenFor: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    }]
}, { timestamps: true });

export default mongoose.model("Conversation", conversationSchema);
