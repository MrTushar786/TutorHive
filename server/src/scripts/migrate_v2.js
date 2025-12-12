
import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "../models/User.js";
import Booking from "../models/Booking.js";
import Message from "../models/Message.js";
import TutorProfile from "../models/TutorProfile.js";
import AvailabilitySlot from "../models/AvailabilitySlot.js";
import Review from "../models/Review.js";
import Subject from "../models/Subject.js";
import Payment from "../models/Payment.js";
import AuditLog from "../models/AuditLog.js";

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/tutorhive";

async function connectDB() {
    if (mongoose.connection.readyState === 0) {
        await mongoose.connect(MONGODB_URI);
        console.log("Connected to MongoDB");
    }
}

async function migrateUsersToTutorProfiles() {
    console.log("--- Migrating Tutors to TutorProfiles ---");
    const tutors = await User.find({ role: "tutor" });
    let count = 0;

    for (const tutor of tutors) {
        // Check if profile exists
        const existingProfile = await TutorProfile.findOne({ userId: tutor._id });
        if (existingProfile) {
            console.log(`Profile for ${tutor.email} already exists. Skipping.`);
            continue;
        }

        // Derive search text
        const searchText = [
            tutor.name,
            tutor.bio || "",
            (tutor.subjects || []).join(" "),
            (tutor.expertise || []).join(" ")
        ].join(" ").toLowerCase();

        // Create Profile
        const profile = new TutorProfile({
            userId: tutor._id,
            headline: (tutor.bio || "").slice(0, 50) + "...", // Fallback headline
            bio: tutor.bio,
            hourlyRate: tutor.hourlyRate || 0,
            city: "Unknown", // Field missing in old schema, set default
            subjects: tutor.subjects || [],
            expertise: tutor.expertise || [],
            rating: tutor.rating || 0,
            totalReviews: tutor.reviews || 0,
            searchText,
            stats: {
                completedLessons: tutor.stats?.completedLessons || 0,
                totalEarnings: tutor.stats?.totalEarnings || 0,
            }
        });

        await profile.save();
        count++;

        // Migrate Availability
        // Old schema: availability: ["Mon 10:00-12:00", ...] (Array of strings)
        // We need to parse this. Assuming implicit recurring for next 90 days.
        await migrateAvailability(tutor._id, tutor.availability);
    }
    console.log(`Migrated ${count} tutor profiles.`);
}

async function migrateAvailability(tutorId, availabilityStrings) {
    if (!availabilityStrings || availabilityStrings.length === 0) return;

    const validDays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const slots = [];

    // Generate slots for next 90 days
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < 90; i++) {
        const currentDate = new Date(today);
        currentDate.setDate(today.getDate() + i);
        const dayName = validDays[currentDate.getDay()]; // e.g., "Monday"

        // Find strings matching this day. Example: "Monday 10:00-12:00"
        // Adjust parsing logic to match your actual data format
        const dayMatches = availabilityStrings.filter(s => s.toLowerCase().startsWith(dayName.toLowerCase()));

        for (const match of dayMatches) {
            try {
                // Parse "Monday 10:00-12:00"
                const parts = match.split(" ");
                if (parts.length < 2) continue;
                const timeRange = parts[1]; // "10:00-12:00"
                const [startStr, endStr] = timeRange.split("-");

                const [startHours, startMins] = startStr.split(":").map(Number);
                const [endHours, endMins] = endStr.split(":").map(Number);

                const startUTC = new Date(currentDate);
                startUTC.setHours(startHours, startMins, 0, 0);

                const endUTC = new Date(currentDate);
                endUTC.setHours(endHours, endMins, 0, 0);

                const durationMin = (endUTC - startUTC) / 60000;

                // Skip invalid
                if (durationMin <= 0) continue;

                // Check for duplicate (idempotency)
                const exists = await AvailabilitySlot.findOne({
                    tutorId,
                    startUTC,
                    endUTC
                });

                if (!exists) {
                    slots.push({
                        tutorId,
                        startUTC,
                        endUTC,
                        durationMin,
                        isBooked: false,
                        source: "recurring"
                    });
                }
            } catch (err) {
                console.error(`Failed to parse availability string '${match}':`, err.message);
            }
        }
    }

    if (slots.length > 0) {
        try {
            await AvailabilitySlot.insertMany(slots, { ordered: false });
        } catch (e) {
            // Ignore dupes mainly
        }
        console.log(`  > Created ${slots.length} slots for tutor ${tutorId}`);
    }
}

async function migrateBookingsAndFeedback() {
    console.log("--- Migrating Bookings & Creating Slots/Reviews ---");
    const bookings = await Booking.find({});
    let updatedCount = 0;
    let reviewCount = 0;

    for (const booking of bookings) {
        let slotId = booking.slotId;

        // 1. Create/Link Slot if missing
        if (!slotId) {
            // Look for a matching slot
            let slot = await AvailabilitySlot.findOne({
                tutorId: booking.tutor,
                startUTC: booking.startTime
            });

            if (!slot) {
                // Create Ad-hoc Slot
                slot = new AvailabilitySlot({
                    tutorId: booking.tutor,
                    startUTC: booking.startTime,
                    endUTC: new Date(booking.startTime.getTime() + booking.duration * 60000),
                    durationMin: booking.duration,
                    isBooked: true, // It is booked
                    bookingId: booking._id,
                    source: "adhoc"
                });
                await slot.save();
            } else {
                // Update existing slot
                if (!slot.isBooked) {
                    slot.isBooked = true;
                    slot.bookingId = booking._id;
                    await slot.save();
                }
            }
            slotId = slot._id;
        }

        // 2. Link Payment (Mock stub for migration)
        if (booking.status === "confirmed" || booking.status === "completed") {
            if (!booking.paymentId) {
                const payment = new Payment({
                    bookingId: booking._id,
                    amount: booking.price,
                    status: "completed",
                    provider: "migration_stub"
                });
                await payment.save();
                booking.paymentId = payment._id;
            }
        }

        // 3. Migrate Feedback to Review
        if (booking.feedback && booking.feedback.rating && !booking.reviewMigrated) {
            // Look up tutor profile
            const tutorProfile = await TutorProfile.findOne({ userId: booking.tutor });
            if (tutorProfile) {
                const review = new Review({
                    bookingId: booking._id,
                    studentId: booking.student,
                    tutorProfileId: tutorProfile._id,
                    rating: booking.feedback.rating,
                    text: booking.feedback.comment,
                    createdAt: booking.feedback.submittedAt || booking.updatedAt
                });
                await review.save();
                reviewCount++;
            }
        }

        booking.slotId = slotId;
        booking.endTime = new Date(booking.startTime.getTime() + booking.duration * 60000);
        await booking.save();
        updatedCount++;
    }
    console.log(`Updated ${updatedCount} bookings, Created ${reviewCount} reviews.`);
}


async function migrateMessages() {
    console.log("--- Migrating Messages ---");
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    // Check count of old messages
    const oldMessagesCount = await Message.countDocuments({ createdAt: { $lt: ninetyDaysAgo } });

    if (oldMessagesCount > 0) {
        console.log(`Found ${oldMessagesCount} messages older than 90 days.`);
        console.warn("To complete archive migration, define MessageArchive model and uncomment migration logic.");
        // Logic to move messages would go here
    } else {
        console.log("No messages older than 90 days found.");
    }
}

async function runMigration() {
    try {
        await connectDB();

        // Create Indexes
        await User.init();
        await TutorProfile.init();
        await AvailabilitySlot.init();
        await Booking.init();
        await Payment.init();

        await migrateUsersToTutorProfiles();
        await migrateBookingsAndFeedback();
        await migrateMessages();

        // Recalculate Ratings
        console.log("--- Recalculating Ratings ---");
        const profiles = await TutorProfile.find({});
        for (const profile of profiles) {
            const stats = await Review.aggregate([
                { $match: { tutorProfileId: profile._id } },
                { $group: { _id: null, avgRating: { $avg: "$rating" }, count: { $sum: 1 } } }
            ]);

            if (stats.length > 0) {
                profile.rating = Math.round(stats[0].avgRating * 10) / 10;
                profile.totalReviews = stats[0].count;
                await profile.save();
            }
        }

        console.log("--- Migration Complete ---");
        process.exit(0);
    } catch (error) {
        console.error("Migration Failed:", error);
        process.exit(1);
    }
}

runMigration();
