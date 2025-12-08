import jwt from "jsonwebtoken";

export function createAuthToken(user) {
  return jwt.sign(
    {
      role: user.role,
      email: user.email,
    },
    process.env.JWT_SECRET,
    {
      subject: user._id.toString(),
      expiresIn: "7d",
    }
  );
}

