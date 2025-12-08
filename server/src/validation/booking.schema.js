import { z } from "zod";

export const createBookingSchema = z.object({
  tutorId: z.string().trim().min(1),
  subject: z.string().trim().min(2),
  startTime: z.string().datetime(),
  duration: z.number().min(30).max(180),
  notes: z.string().max(500).optional(),
});

