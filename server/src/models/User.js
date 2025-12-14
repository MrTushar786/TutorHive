import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const statsSchema = new mongoose.Schema(
  {
    completedLessons: { type: Number, default: 0 },
    upcomingLessons: { type: Number, default: 0 },
    totalHours: { type: Number, default: 0 },
    progressPercentage: { type: Number, default: 0 },
    totalStudents: { type: Number, default: 0 },
    completedSessions: { type: Number, default: 0 },
    totalEarnings: { type: Number, default: 0 },
    averageRating: { type: Number, default: 0 },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: {
      type: String,
      required: function () { return !this.googleId; },
      minlength: 6
    },
    googleId: { type: String, unique: true, sparse: true },
    role: {
      type: String,
      required: true,
      enum: ["student", "tutor", "admin"],
      default: "student",
    },
    avatar: { type: String },
    subjects: [{ type: String }],
    hourlyRate: { type: Number },
    expertise: [{ type: String }],
    availability: [{ type: String }],
    bio: { type: String },
    rating: { type: Number, default: 4.9 },
    reviews: { type: Number, default: 0 },
    stats: {
      type: statsSchema,
      default: () => ({}),
    },
  },
  { timestamps: true }
);

userSchema.pre("save", async function hashPassword(next) {
  if (!this.isModified("password")) {
    return next();
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.comparePassword = function comparePassword(password) {
  return bcrypt.compare(password, this.password);
};

userSchema.methods.toJSON = function toJSON() {
  const obj = this.toObject({ getters: true, versionKey: false });
  delete obj.password;
  return obj;
};

const User = mongoose.model("User", userSchema);

export default User;

