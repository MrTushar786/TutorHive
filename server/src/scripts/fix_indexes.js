
import mongoose from "mongoose";
import dotenv from "dotenv";
import TutorProfile from "../models/TutorProfile.js";

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/tutorhive";

async function fixIndexes() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log("Connected to MongoDB");

        console.log("--- Fixing Indexes for TutorProfile ---");

        // Get indexes
        const indexes = await TutorProfile.collection.indexes();
        console.log("Existing indexes:", indexes.map(i => i.name));

        // Drop specific problematic index 'user_1' if it exists
        const userIndex = indexes.find(i => i.name === 'user_1');
        if (userIndex) {
            console.log("Dropping stale index: user_1");
            await TutorProfile.collection.dropIndex('user_1');
            console.log("Dropped user_1");
        } else {
            console.log("Index user_1 not found (already clean).");
        }

        // Drop 'email_1' if it exists (sometimes copied from User)
        const emailIndex = indexes.find(i => i.name === 'email_1');
        if (emailIndex) {
            await TutorProfile.collection.dropIndex('email_1');
            console.log("Dropped email_1");
        }

        // Sync defined indexes
        console.log("Syncing indexes to schema...");
        await TutorProfile.syncIndexes();
        console.log("Indexes synced.");

        process.exit(0);
    } catch (error) {
        console.error("Index Fix Failed:", error);
        process.exit(1);
    }
}

fixIndexes();
