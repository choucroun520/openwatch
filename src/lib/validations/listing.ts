import { z } from "zod";
import { MATERIALS, CONDITIONS, MOVEMENTS, COMPLICATIONS, CASE_SIZES } from "@/lib/constants";

const priceString = z
  .string()
  .min(1, "Price is required")
  .regex(/^\d+(\.\d{1,2})?$/, "Invalid price format");

export const createListingSchema = z.object({
  brand_id: z.string().uuid("Invalid brand"),
  model_id: z.string().uuid("Invalid model"),
  reference_number: z.string().min(3, "Reference number required").max(50),
  serial_number: z.string().max(50).optional().or(z.literal("")),
  year: z
    .number()
    .int()
    .min(1900, "Invalid year")
    .max(new Date().getFullYear() + 1, "Invalid year"),
  material: z.enum(MATERIALS, { error: "Invalid material" }),
  dial_color: z.string().min(1, "Dial color required").max(50),
  case_size: z.enum(CASE_SIZES).optional().or(z.literal("")),
  movement: z.enum(MOVEMENTS).optional(),
  complications: z.array(z.enum(COMPLICATIONS)).optional().default([]),
  condition: z.enum(CONDITIONS, { error: "Invalid condition" }),
  condition_score: z.number().min(0).max(10).optional(),
  has_box: z.boolean().default(false),
  has_papers: z.boolean().default(false),
  has_warranty: z.boolean().default(false),
  warranty_date: z.string().optional().or(z.literal("")),
  service_history: z.string().max(1000).optional().or(z.literal("")),
  wholesale_price: priceString,
  retail_price: priceString.optional().or(z.literal("")),
  currency: z.string().default("USD"),
  accepts_inquiries: z.boolean().default(true),
  images: z.array(z.string().url()).max(10).optional().default([]),
  notes: z.string().max(2000).optional().or(z.literal("")),
});

export const updateListingSchema = createListingSchema.partial().extend({
  status: z.enum(["active", "pending", "sold", "delisted"]).optional(),
});

export type CreateListingInput = z.infer<typeof createListingSchema>;
export type UpdateListingInput = z.infer<typeof updateListingSchema>;
