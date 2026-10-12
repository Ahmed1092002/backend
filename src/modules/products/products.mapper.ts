import type { Product as PrismaProduct } from "@prisma/client";
import type { ProductResponseDto } from "./products.dto.js";

export function toProductResponseDto(
  product: PrismaProduct,
): ProductResponseDto {
  return {
    id: product.id,
    name: product.name,
    price: product.price.toNumber(),
    stock: product.stock,
    imageUrl: product.imagePath,
  };
}
