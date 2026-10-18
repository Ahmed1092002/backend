import type { Prisma } from "@prisma/client";
import type { ProductResponseDto } from "./products.dto.js";

type ProductForResponse = {
  id: string;
  name: string;
  price: Prisma.Decimal;
  stock: number;
  imagePath: string | null;
};

export function toProductResponseDto(
  product: ProductForResponse,
): ProductResponseDto {
  return {
    id: product.id,
    name: product.name,
    price: product.price.toNumber(),
    stock: product.stock,
    imageUrl: product.imagePath,
  };
}
