import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";

import User from "../models/User.js";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

const handleSocialLogin = async (provider, profile, done) => {
    try {
        const email = profile.emails?.[0]?.value;

        if (!email) {
            return done(new Error(`No email found in ${provider} profile`));
        }

        // 1. Check if user exists with this social ID
        let user = await User.findOne({ [`${provider}Id`]: profile.id });

        if (user) {
            return done(null, user);
        }

        // 2. Check if user exists with this email
        user = await User.findOne({ email });

        if (user) {
            // Link account
            user[`${provider}Id`] = profile.id;
            // If photo absent, optionally update it
            if (!user.avatar && profile.photos?.[0]?.value) {
                user.avatar = profile.photos[0].value;
            }
            await user.save();
            return done(null, user);
        }

        // 3. Create new user
        user = await User.create({
            name: profile.displayName || `${profile.name?.givenName} ${profile.name?.familyName}`,
            email,
            [`${provider}Id`]: profile.id,
            avatar: profile.photos?.[0]?.value,
            role: "student", // Default role
            isVerified: true
        });

        return done(null, user);
    } catch (error) {
        return done(error);
    }
};

if (GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET) {
    passport.use(
        new GoogleStrategy(
            {
                clientID: GOOGLE_CLIENT_ID,
                clientSecret: GOOGLE_CLIENT_SECRET,
                callbackURL: process.env.GOOGLE_CALLBACK_URL ||
                    (process.env.NODE_ENV === 'production'
                        ? "https://tutorhivee.onrender.com/api/auth/google/callback"
                        : "http://localhost:5000/api/auth/google/callback"),
            },
            (accessToken, refreshToken, profile, done) => handleSocialLogin("google", profile, done)
        )
    );
}



export default passport;
