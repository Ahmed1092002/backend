import { randomUUID } from "node:crypto";

export type Product = {
  id: string;
  name: string;
  price: number;
};

type CreateProductInput = {
  name: string;
  price: number;
};

type UpdateProductInput = {
  name?: string | undefined;
  price?: number | undefined;
};

const products: Product[] = [
  { id: "1", name: "Laptop", price: 1200 },
  { id: "2", name: "Keyboard", price: 80 },
];

export function listProducts(): Product[] {
  return products;
}

export function findProductById(id: string): Product | undefined {
  return products.find((product) => product.id === id);
}

export function createProduct(input: CreateProductInput): Product {
  const product: Product = {
    id: randomUUID(),
    ...input,
  };

  products.push(product);
  return product;
}

export function updateProductById(
  id: string,
  input: UpdateProductInput,
): Product | undefined {
  const product = findProductById(id);

  if (!product) {
    return undefined;
  }

  Object.assign(product, input);
  return product;
}

export function deleteProductById(id: string): Product | undefined {
  const index = products.findIndex((product) => product.id === id);

  if (index === -1) {
    return undefined;
  }

  return products.splice(index, 1)[0];
}
