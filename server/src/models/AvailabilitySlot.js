import mongoose from "mongoose";

const availabilitySlotSchema = new mongoose.Schema(
    {
        tutorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        startUTC: { type: Date, required: true },
        endUTC: { type: Date, required: true },
        durationMin: { type: Number, required: true },

        // Status flags
        isBooked: { type: Boolean, default: false, index: true },

        // If booked, reference the booking
        bookingId: { type: mongoose.Schema.Types.ObjectId, ref: "Booking", default: null },

        // Metadata
        source: { type: String, enum: ["recurring", "explicit", "adhoc"], default: "explicit" },
    },
    { timestamps: true }
);

// Critical constraint: a tutor cannot have overlapping slots
// Using unique compound index on start time to prevent exact duplicates
// Note: This simple index prevents exact start matches. 
// For true overlap prevention, application logic or range indexes are needed.
availabilitySlotSchema.index({ tutorId: 1, startUTC: 1, endUTC: 1 }, { unique: true });

// Index for finding free slots
availabilitySlotSchema.index({ tutorId: 1, isBooked: 1, startUTC: 1 });

const AvailabilitySlot = mongoose.model("AvailabilitySlot", availabilitySlotSchema);

export default AvailabilitySlot;
