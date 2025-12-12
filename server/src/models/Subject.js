import mongoose from "mongoose";

const subjectSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, unique: true, trim: true },
        slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
        parentId: { type: mongoose.Schema.Types.ObjectId, ref: "Subject", default: null },
        isActive: { type: Boolean, default: true },
    },
    { timestamps: true }
);

const Subject = mongoose.model("Subject", subjectSchema);

export default Subject;
