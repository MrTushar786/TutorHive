import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema(
    {
        bookingId: { type: mongoose.Schema.Types.ObjectId, ref: "Booking", required: true }, // Ensure verified purchase
        studentId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        tutorProfileId: { type: mongoose.Schema.Types.ObjectId, ref: "TutorProfile", required: true }, // Link to profile

        rating: { type: Number, required: true, min: 1, max: 5 },
        text: { type: String, trim: true, maxlength: 1000 },

        isPublic: { type: Boolean, default: true },
    },
    { timestamps: true }
);

// Prevent multiple reviews for same booking
reviewSchema.index({ bookingId: 1 }, { unique: true });

const Review = mongoose.model("Review", reviewSchema);

export default Review;
