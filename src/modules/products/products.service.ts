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
