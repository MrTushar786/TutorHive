import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().min(2).max(60),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(["student", "tutor"]).default("student"),
  confirmPassword: z.string().min(6),
  subjects: z.array(z.string()).optional(),
  hourlyRate: z.number().min(10).max(200).optional(),
  expertise: z.array(z.string()).optional(),
  availability: z.array(z.string()).optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

