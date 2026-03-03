import { z } from "zod";

export const createInquirySchema = z.object({
  listing_id: z.string().uuid("Invalid listing"),
  message: z
    .string()
    .min(10, "Message must be at least 10 characters")
    .max(2000, "Message too long"),
  offer_price: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, "Invalid offer price format")
    .optional()
    .or(z.literal("")),
});

export type CreateInquiryInput = z.infer<typeof createInquirySchema>;
