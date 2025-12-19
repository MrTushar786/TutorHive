import { StatusCodes } from "http-status-codes";
import User from "../models/User.js";
import TutorProfile from "../models/TutorProfile.js";
import { createAuthToken } from "../utils/token.js";
import { loginSchema, registerSchema } from "../validation/auth.schema.js";

export async function register(req, res) {
  const payload = registerSchema.parse(req.body);

  if (payload.password !== payload.confirmPassword) {
    return res.status(StatusCodes.BAD_REQUEST).json({ message: "Passwords do not match" });
  }

  const existing = await User.findOne({ email: payload.email });
  if (existing) {
    return res.status(StatusCodes.CONFLICT).json({ message: "Email already registered" });
  }

  // 1. Create User (Base Identity)
  const user = await User.create({
    name: payload.name,
    email: payload.email,
    password: payload.password,
    role: payload.role,
    // Store generic bio if provided, or leave for profile
    bio: payload.bio,
    avatar: payload.avatar,
    hourlyRate: payload.hourlyRate // Sync hourlyRate to User model for booking calculations
  });

  // 2. If Tutor, Create TutorProfile
  if (payload.role === "tutor") {
    const searchText = [
      payload.name,
      payload.bio || "",
      (payload.subjects || []).join(" "),
      (payload.expertise || []).join(" ")
    ].join(" ").toLowerCase();

    await TutorProfile.create({
      userId: user._id,
      headline: (payload.bio || "").slice(0, 50),
      bio: payload.bio,
      hourlyRate: payload.hourlyRate || 0,
      subjects: payload.subjects || [],
      expertise: payload.expertise || [],
      city: "Online", // Default, can be updated later
      rating: 0,
      totalReviews: 0,
      searchText,
      stats: {}
    });
  }

  const token = createAuthToken(user);

  res.status(StatusCodes.CREATED).json({
    user,
    token,
  });
}

export async function login(req, res) {
  const payload = loginSchema.parse(req.body);

  const user = await User.findOne({ email: payload.email });
  if (!user) {
    return res.status(StatusCodes.UNAUTHORIZED).json({ message: "Invalid credentials" });
  }

  const isMatch = await user.comparePassword(payload.password);
  if (!isMatch) {
    return res.status(StatusCodes.UNAUTHORIZED).json({ message: "Invalid credentials" });
  }

  const token = createAuthToken(user);

  res.json({
    user,
    token,
  });
}

export async function getProfile(req, res) {
  const { userId } = req.params;
  const targetUserId = userId || req.user.id;

  // Users can only view their own profile unless admin
  if (req.user.role !== "admin" && req.user.id !== targetUserId) {
    return res.status(StatusCodes.FORBIDDEN).json({ message: "Not authorized" });
  }

  const user = await User.findById(targetUserId);
  if (!user) {
    return res.status(StatusCodes.NOT_FOUND).json({ message: "User not found" });
  }

  // Merge with TutorProfile if tutor
  let responseData = user.toJSON();
  if (user.role === "tutor") {
    const profile = await TutorProfile.findOne({ userId: user._id });
    if (profile) {
      responseData = { ...responseData, ...profile.toJSON(), _id: user._id }; // ensure User _id is top level
      // Profile fields might override User fields, which is usually intended for things like 'bio'
    }
  }

  res.json({ user: responseData });
}

export async function updateProfile(req, res) {
  const { userId } = req.params;
  const targetUserId = userId || req.user.id;

  // Users can only update their own profile unless admin
  if (req.user.role !== "admin" && req.user.id !== targetUserId) {
    return res.status(StatusCodes.FORBIDDEN).json({ message: "Not authorized" });
  }

  const user = await User.findById(targetUserId);
  if (!user) {
    return res.status(StatusCodes.NOT_FOUND).json({ message: "User not found" });
  }

  const updates = req.body;

  // 1. Update User Base Fields
  if (updates.name) user.name = updates.name;
  if (updates.avatar) user.avatar = updates.avatar;
  // If we decide bio lives on Profile, we can skip it here, but let's keep it synced for now or just on User
  if (updates.bio) user.bio = updates.bio;
  if (updates.hourlyRate !== undefined) user.hourlyRate = updates.hourlyRate; // Sync hourlyRate to User model
  await user.save();

  // 2. Update TutorProfile if applicable
  if (user.role === "tutor") {
    const profile = await TutorProfile.findOne({ userId: user._id });
    if (profile) {
      const profileFields = ["headline", "bio", "subjects", "hourlyRate", "expertise", "city", "yearsOfExperience", "availabilityDisplay"];
      profileFields.forEach(f => {
        if (updates[f] !== undefined) profile[f] = updates[f];
      });

      // Recompute search text if needed
      if (updates.name || updates.bio || updates.subjects || updates.expertise) {
        profile.searchText = [
          user.name,
          profile.headline || "",
          (profile.subjects || []).join(" "),
          (profile.expertise || []).join(" ")
        ].join(" ").toLowerCase();
      }
      await profile.save();
    } else {
      // Create if missing (lazy migration)
      await TutorProfile.create({
        userId: user._id,
        headline: updates.headline || "",
        bio: updates.bio || user.bio,
        hourlyRate: updates.hourlyRate || 0,
        subjects: updates.subjects || [],
        expertise: updates.expertise || [],
        searchText: user.name.toLowerCase()
      });
    }
  }

  // Return merged
  let responseData = user.toJSON();
  if (user.role === "tutor") {
    const profile = await TutorProfile.findOne({ userId: user._id });
    if (profile) {
      responseData = { ...responseData, ...profile.toJSON(), _id: user._id };
    }
  }

  res.json({ user: responseData });
}



