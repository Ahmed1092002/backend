# Milestone 5: Products Router

## What changed

The API now has a small Products module backed by an in-memory array.

```text
GET /products
  -> request logger
  -> products router
  -> products route handler
  -> JSON response
```

## Endpoints

- `GET /products` returns all products.
- `GET /products/:id` returns one product or a JSON 404.

## Why a router?

`app.ts` wires modules together. The Products router owns only product URLs. This keeps the entry application small as Users and Orders are added later.

## Spring Boot comparison

The router is close to a Spring `@RestController` grouped around `/products` endpoints. We will introduce a separate service when the product logic grows beyond this static example.
