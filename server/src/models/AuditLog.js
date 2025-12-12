import mongoose from "mongoose";

const auditLogSchema = new mongoose.Schema(
    {
        action: { type: String, required: true }, // e.g., "BOOKING_CREATED", "SLOT_RELEASED"
        entityType: { type: String, required: true }, // e.g., "Booking", "Payment"
        entityId: { type: mongoose.Schema.Types.ObjectId, required: true },

        byUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // Who performed the action
        changes: { type: mongoose.Schema.Types.Mixed }, // Diff or payload

        metadata: { type: mongoose.Schema.Types.Mixed },
    },
    { timestamps: true }
);

// Expire logs after 1 year automatically
auditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 365 * 24 * 60 * 60 });

const AuditLog = mongoose.model("AuditLog", auditLogSchema);

export default AuditLog;
