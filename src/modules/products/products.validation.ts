import { z } from "zod";

const invalidPriceMessage = "price must be a non-negative number";

export const createProductSchema = z.object({
  name: z.string().trim().min(1, "name must be a non-empty string"),
  price: z
    .number({ error: invalidPriceMessage })
    .finite(invalidPriceMessage)
    .nonnegative(invalidPriceMessage),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
