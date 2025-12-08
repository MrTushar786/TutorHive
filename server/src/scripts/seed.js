import dotenv from "dotenv";
import connectDB from "../config/db.js";
import User from "../models/User.js";
import Booking from "../models/Booking.js";

dotenv.config();

const subjects = ["Mathematics", "Physics", "Chemistry", "Computer Science", "Biology", "English Literature"];

function getRandomSubject() {
  return subjects[Math.floor(Math.random() * subjects.length)];
}

async function seed() {
  await connectDB();

  await Booking.deleteMany();
  await User.deleteMany();

  const tutors = await User.create([
    {
      name: "Dr. Sarah Miller",
      email: "sarah@tutorhive.com",
      password: "password123",
      role: "tutor",
      subjects: ["Mathematics"],
      hourlyRate: 45,
      expertise: ["Calculus", "Algebra", "Geometry"],
      availability: ["Mon-Fri"],
      rating: 4.9,
      reviews: 234,
      stats: {
        totalStudents: 45,
        completedSessions: 120,
        totalEarnings: 5400,
        averageRating: 4.9,
      },
    },
    {
      name: "Prof. John Davis",
      email: "john@tutorhive.com",
      password: "password123",
      role: "tutor",
      subjects: ["Physics"],
      hourlyRate: 50,
      expertise: ["Mechanics", "Thermodynamics", "Quantum"],
      availability: ["Mon-Sat"],
      rating: 4.8,
      reviews: 189,
      stats: {
        totalStudents: 38,
        completedSessions: 110,
        totalEarnings: 4800,
        averageRating: 4.8,
      },
    },
  ]);

  const students = await User.create([
    {
      name: "Alex Johnson",
      email: "alex@student.com",
      password: "password123",
      role: "student",
      stats: {
        completedLessons: 24,
        upcomingLessons: 3,
        totalHours: 36,
        progressPercentage: 68,
      },
    },
    {
      name: "Jamie Lee",
      email: "jamie@student.com",
      password: "password123",
      role: "student",
      stats: {
        completedLessons: 18,
        upcomingLessons: 2,
        totalHours: 30,
        progressPercentage: 62,
      },
    },
  ]);

  const bookingsPayload = [];
  const now = new Date();

  students.forEach((student) => {
    tutors.forEach((tutor, index) => {
      for (let i = 1; i <= 3; i += 1) {
        bookingsPayload.push({
          student: student._id,
          tutor: tutor._id,
          subject: tutor.subjects[0],
          startTime: new Date(now.getTime() + (i + index) * 24 * 60 * 60 * 1000),
          duration: 60,
          price: tutor.hourlyRate,
          status: i % 3 === 0 ? "completed" : "confirmed",
          notes: "Auto generated session",
        });
      }
    });
  });

  const randomCompletedSessions = Array.from({ length: 6 }).map(() => ({
    student: students[Math.floor(Math.random() * students.length)]._id,
    tutor: tutors[Math.floor(Math.random() * tutors.length)]._id,
    subject: getRandomSubject(),
    startTime: new Date(now.getTime() - Math.random() * 20 * 24 * 60 * 60 * 1000),
    duration: 60,
    price: 40 + Math.floor(Math.random() * 20),
    status: "completed",
  }));

  await Booking.insertMany([...bookingsPayload, ...randomCompletedSessions]);

  console.log("Database seeded successfully");
  process.exit(0);
}

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});

