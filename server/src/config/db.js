import mongoose from "mongoose";

export default async function connectDB(uri = process.env.MONGODB_URI) {
  if (!uri) {
    throw new Error("MONGODB_URI is not defined");
  }

  mongoose.set("strictQuery", true);

  await mongoose.connect(uri, {
    autoIndex: true,
  });
}

