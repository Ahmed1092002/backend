import { z } from "zod";

const orderItemSchema = z.object({
  productId: z.string().uuid("productId must be a UUID"),
  quantity: z.number().int().min(1, "quantity must be at least 1"),
});

export const createOrderSchema = z
  .object({
    items: z.array(orderItemSchema).min(1, "An order needs at least one item"),
  })
  .refine(
    ({ items }) => new Set(items.map((item) => item.productId)).size === items.length,
    "A product may appear only once in an order",
  );

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
