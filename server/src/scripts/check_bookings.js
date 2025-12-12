
import mongoose from "mongoose";
import Booking from "../models/Booking.js";
import User from "../models/User.js";
import dotenv from "dotenv";

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/tutorhive";

async function checkBookings() {
    await mongoose.connect(MONGODB_URI);

    const user = await User.findOne({ email: "focousmed@gmail.com" });
    if (!user) {
        console.log("User not found");
        process.exit(0);
    }

    console.log("User ID:", user._id);

    const bookings = await Booking.find({ student: user._id });
    console.log(`Found ${bookings.length} bookings for this user.`);

    bookings.forEach(b => {
        console.log(`- Booking ${b._id}: Status=${b.status}, Start=${b.startTime.toISOString()}, Now=${new Date().toISOString()}`);
    });

    process.exit(0);
}

checkBookings();
