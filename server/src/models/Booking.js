import mongoose from "mongoose";

const bookingSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    // In new architecture, we might want to reference TutorProfile, but keeping User ref for tutor is easier for now.
    // We can add tutorProfileId as optional.
    tutor: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    tutorProfileId: { type: mongoose.Schema.Types.ObjectId, ref: "TutorProfile" },

    subject: { type: String, required: true },

    // Time fields - ideally derived from slot, but kept denormalized for easy querying
    startTime: { type: Date, required: true },
    endTime: { type: Date }, // Added for clear duration boundary
    duration: { type: Number, required: true }, // in minutes

    // Slot Reference (Critical for concurrency)
    slotId: { type: mongoose.Schema.Types.ObjectId, ref: "AvailabilitySlot" },

    status: {
      type: String,
      enum: ["pending", "confirmed", "completed", "cancelled", "no-show"],
      default: "pending",
    },

    price: { type: Number, required: true },
    paymentId: { type: mongoose.Schema.Types.ObjectId, ref: "Payment" },

    notes: { type: String },
    meetingRoomId: { type: String }, // Unique room ID for video calls

    // Legacy Feedback (Deprecated in favor of Review model)
    feedback: {
      rating: { type: Number, min: 1, max: 5 },
      comment: { type: String },
      submittedAt: { type: Date },
    },

    metadata: {
      timezone: String,
      clientIp: String,
      cancellationReason: String
    }
  },
  { timestamps: true }
);

// Indexes
bookingSchema.index({ student: 1, status: 1 });
bookingSchema.index({ tutor: 1, status: 1 });
bookingSchema.index({ slotId: 1 }, { unique: true, sparse: true }); // A slot can only be used by one valid booking

const Booking = mongoose.model("Booking", bookingSchema);

export default Booking;

