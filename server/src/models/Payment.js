import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
    {
        bookingId: { type: mongoose.Schema.Types.ObjectId, ref: "Booking", required: true },
        amount: { type: Number, required: true },
        currency: { type: String, default: "USD" },

        // Status
        status: {
            type: String,
            enum: ["pending", "completed", "failed", "refunded"],
            default: "pending"
        },

        // Provider Details (Stripe/PayPal etc)
        provider: { type: String, default: "stripe" },
        providerTxId: { type: String, unique: true, sparse: true },
        providerResponse: { type: mongoose.Schema.Types.Mixed }, // flexible JSON

        // Idempotency
        idempotencyKey: { type: String, unique: true, sparse: true },
    },
    { timestamps: true }
);

const Payment = mongoose.model("Payment", paymentSchema);

export default Payment;
