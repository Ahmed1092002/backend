import type { ProductResponseDto } from "./products.dto.js";
import { toProductResponseDto } from "./products.mapper.js";
import * as productsRepository from "./products.repository.js";
import { clearProductCache, getCache, setCache } from "../../cache/redis.js";
import { emitProductEvent } from "../../realtime/socket.js";

type CreateProductInput = {
  name: string;
  price: number;
};

type UpdateProductInput = {
  name?: string | undefined;
  price?: number | undefined;
};

type ProductPageOptions = {
  offset: number;
  limit: number;
  sortBy: "id" | "name" | "price" | "createdAt";
  sortOrder: "asc" | "desc";
  search?: string | undefined;
  minPrice?: number | undefined;
  maxPrice?: number | undefined;
};

type ProductPage = {
  products: ProductResponseDto[];
  total: number;
};

export async function listProducts({
  offset,
  limit,
  sortBy,
  sortOrder,
  search,
  minPrice,
  maxPrice,
}: ProductPageOptions): Promise<ProductPage> {
  const cacheKey = `products:${JSON.stringify({ offset, limit, sortBy, sortOrder, search, minPrice, maxPrice })}`;
  const cached = await getCache<ProductPage>(cacheKey);
  if (cached) return cached;
  const [products, total] = await Promise.all([
    productsRepository.findPage({
      offset,
      limit,
      sortBy,
      sortOrder,
      search,
      minPrice,
      maxPrice,
    }),
    productsRepository.count({
      offset,
      limit,
      sortBy,
      sortOrder,
      search,
      minPrice,
      maxPrice,
    }),
  ]);

  const result = {
    products: products.map(toProductResponseDto),
    total,
  };
  await setCache(cacheKey, result, 60);
  return result;
}

export async function findProductById(
  id: string,
): Promise<ProductResponseDto | undefined> {
  const product = await productsRepository.findById(id);
  return product ? toProductResponseDto(product) : undefined;
}

export async function createProduct(
  input: CreateProductInput,
): Promise<ProductResponseDto> {
  const product = await productsRepository.create(input);
  await clearProductCache();
  const result = toProductResponseDto(product);
  emitProductEvent("product:created", result);
  return result;
}

export async function updateProductById(
  id: string,
  input: UpdateProductInput,
): Promise<ProductResponseDto | undefined> {
  const existingProduct = await productsRepository.findById(id);

  if (!existingProduct) {
    return undefined;
  }

  const data = {
    ...(input.name === undefined ? {} : { name: input.name }),
    ...(input.price === undefined ? {} : { price: input.price }),
  };

  const product = await productsRepository.updateById(id, data);
  await clearProductCache();

  const result = toProductResponseDto(product);
  emitProductEvent("product:updated", result);
  return result;
}

export async function setProductImage(
  id: string,
  imagePath: string,
): Promise<ProductResponseDto | undefined> {
  const existingProduct = await productsRepository.findById(id);

  if (!existingProduct) {
    return undefined;
  }

  const product = await productsRepository.updateById(id, { imagePath });
  await clearProductCache();
  const result = toProductResponseDto(product);
  emitProductEvent("product:updated", result);
  return result;
}

export async function deleteProductById(
  id: string,
): Promise<ProductResponseDto | undefined> {
  const existingProduct = await productsRepository.findById(id);

  if (!existingProduct) {
    return undefined;
  }

  const product = await productsRepository.deleteById(id);
  await clearProductCache();
  const result = toProductResponseDto(product);
  emitProductEvent("product:deleted", result);
  return result;
}
