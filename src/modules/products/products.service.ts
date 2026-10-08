import type { ProductResponseDto } from "./products.dto.js";
import { toProductResponseDto } from "./products.mapper.js";
import * as productsRepository from "./products.repository.js";

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
};

type ProductPage = {
  products: ProductResponseDto[];
  total: number;
};

export async function listProducts({
  offset,
  limit,
}: ProductPageOptions): Promise<ProductPage> {
  const [products, total] = await Promise.all([
    productsRepository.findPage({ offset, limit }),
    productsRepository.count(),
  ]);

  return {
    products: products.map(toProductResponseDto),
    total,
  };
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
  return toProductResponseDto(product);
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

  return toProductResponseDto(product);
}

export async function deleteProductById(
  id: string,
): Promise<ProductResponseDto | undefined> {
  const existingProduct = await productsRepository.findById(id);

  if (!existingProduct) {
    return undefined;
  }

  const product = await productsRepository.deleteById(id);
  return toProductResponseDto(product);
}
