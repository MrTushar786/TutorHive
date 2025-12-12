import mongoose from "mongoose";

const videoRoomSchema = new mongoose.Schema(
    {
        bookingId: { type: mongoose.Schema.Types.ObjectId, ref: "Booking", unique: true, sparse: true },
        roomName: { type: String, required: true }, // The ID used in socket rooms

        participants: [{
            userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
            joinedAt: Date,
            leftAt: Date
        }],

        startedAt: { type: Date },
        endedAt: { type: Date },

        // Recording
        recordingUrl: { type: String }, // S3 Signed URL or path
        recordingStatus: { type: String, enum: ["none", "processing", "available", "failed", "deleted"], default: "none" },

        metadata: { type: mongoose.Schema.Types.Mixed }
    },
    { timestamps: true }
);

const VideoRoom = mongoose.model("VideoRoom", videoRoomSchema);

export default VideoRoom;
