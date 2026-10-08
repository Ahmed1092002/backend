import { z } from "zod";

const invalidPriceMessage = "price must be a non-negative number";

const productFields = {
  name: z.string().trim().min(1, "name must be a non-empty string"),
  price: z
    .number({ error: invalidPriceMessage })
    .finite(invalidPriceMessage)
    .nonnegative(invalidPriceMessage),
};

export const createProductSchema = z.object(productFields);

export const updateProductSchema = z
  .object({
    name: productFields.name.optional(),
    price: productFields.price.optional(),
  })
  .refine((input) => Object.keys(input).length > 0, {
    message: "At least one product field must be provided",
  });

export const listProductsQuerySchema = z.object({
  page: z.coerce
    .number()
    .int("page must be a whole number")
    .min(1, "page must be 1 or greater")
    .default(1),
  limit: z.coerce
    .number()
    .int("limit must be a whole number")
    .min(1, "limit must be 1 or greater")
    .max(100, "limit must be 100 or less")
    .default(20),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type ListProductsQueryDto = z.infer<typeof listProductsQuerySchema>;
