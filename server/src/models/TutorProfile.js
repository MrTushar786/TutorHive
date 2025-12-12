import mongoose from "mongoose";

const tutorProfileSchema = new mongoose.Schema(
    {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
        isFeatured: { type: Boolean, default: false },
        headline: { type: String, trim: true },
        bio: { type: String, trim: true },
        hourlyRate: { type: Number, required: true, min: 0 },
        city: { type: String, trim: true, index: true },
        subjects: [{ type: String }], // Denormalized for search, canonical refs could be added
        expertise: [{ type: String }], // Kept for backward compat or elaboration

        yearsOfExperience: { type: Number, default: 0 },
        availabilityDisplay: { type: String, trim: true }, // Simple string for "Mon-Fri 9-5" display

        // Aggregated stats - explicitly managed
        rating: { type: Number, default: 0, index: -1 },
        totalReviews: { type: Number, default: 0 },
        stats: {
            completedLessons: { type: Number, default: 0 },
            totalStudents: { type: Number, default: 0 },
            totalHours: { type: Number, default: 0 },
            totalEarnings: { type: Number, default: 0 }, // Private, ensure select: false in public queries if needed
        },

        // Search optimization
        searchText: { type: String }, // Concat of name, headline, subjects, bio
        tags: [{ type: String }],
    },
    { timestamps: true }
);

// Compound index for search sorting
tutorProfileSchema.index({ city: 1, hourlyRate: 1, rating: -1 });
tutorProfileSchema.index({ searchText: "text", headline: "text", tags: "text" });

const TutorProfile = mongoose.model("TutorProfile", tutorProfileSchema);

export default TutorProfile;
