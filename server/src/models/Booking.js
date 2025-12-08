import mongoose from "mongoose";

const bookingSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    tutor: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    subject: { type: String, required: true },
    startTime: { type: Date, required: true },
    duration: { type: Number, required: true }, // in minutes
    status: {
      type: String,
      enum: ["pending", "confirmed", "completed", "cancelled"],
      default: "pending",
    },
    price: { type: Number, required: true },
    notes: { type: String },
    meetingRoomId: { type: String }, // Unique room ID for video calls
    feedback: {
      rating: { type: Number, min: 1, max: 5 },
      comment: { type: String },
      submittedAt: { type: Date },
    },
  },
  { timestamps: true }
);

const Booking = mongoose.model("Booking", bookingSchema);

export default Booking;

