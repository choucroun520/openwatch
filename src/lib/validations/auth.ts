import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const registerSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      "Password must contain uppercase, lowercase, and a number"
    ),
  full_name: z.string().min(2, "Full name required").max(100),
  company_name: z.string().min(2, "Company name required").max(100),
  invite_code: z
    .string()
    .min(1, "Invite code is required")
    .regex(/^OW-[A-Z]+-\d{3}$/, "Invalid invite code format"),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
