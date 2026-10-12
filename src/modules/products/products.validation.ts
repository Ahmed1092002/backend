import { z } from "zod";

const invalidPriceMessage = "price must be a non-negative number";
const invalidStockMessage = "stock must be a whole number that is 0 or greater";

const productFields = {
  name: z.string().trim().min(1, "name must be a non-empty string"),
  price: z
    .number({ error: invalidPriceMessage })
    .finite(invalidPriceMessage)
    .nonnegative(invalidPriceMessage),
  stock: z.number().int(invalidStockMessage).min(0, invalidStockMessage).default(0),
};

export const createProductSchema = z.object(productFields);

export const updateProductSchema = z
  .object({
    name: productFields.name.optional(),
    price: productFields.price.optional(),
    stock: productFields.stock.optional(),
  })
  .refine((input) => Object.keys(input).length > 0, {
    message: "At least one product field must be provided",
  });

export const adjustProductStockSchema = z.object({
  delta: z
    .number()
    .int("delta must be a whole number")
    .refine((value) => value !== 0, "delta must not be zero"),
  note: z.string().trim().min(1).max(500).optional(),
});

export const stockMovementsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
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
  search: z.string().trim().min(1, "search must not be empty").optional(),
  minPrice: z.coerce
    .number()
    .min(0, "minPrice must be 0 or greater")
    .optional(),
  maxPrice: z.coerce
    .number()
    .min(0, "maxPrice must be 0 or greater")
    .optional(),
  sortBy: z.enum(["id", "name", "price", "createdAt"]).default("id"),
  sortOrder: z.enum(["asc", "desc"]).default("asc"),
}).refine(
  (query) =>
    query.minPrice === undefined ||
    query.maxPrice === undefined ||
    query.minPrice <= query.maxPrice,
  { message: "minPrice must be less than or equal to maxPrice" },
);

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type AdjustProductStockInput = z.infer<typeof adjustProductStockSchema>;
export type StockMovementsQueryDto = z.infer<typeof stockMovementsQuerySchema>;
export type ListProductsQueryDto = z.infer<typeof listProductsQuerySchema>;
