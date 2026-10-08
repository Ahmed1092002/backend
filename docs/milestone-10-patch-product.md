# Milestone 10: Patch Product

## Endpoint

`PATCH /products/:id` changes only fields sent by the client.

```json
{ "price": 999 }
```

Only the product price changes; its name stays the same.

## Flow

```text
PATCH /products/1
  -> updateProductSchema accepts optional name and price
  -> schema rejects an empty object
  -> controller selects 200 or 404
  -> service finds and mutates the in-memory product
```

## HTTP semantics

- `POST /products`: create a new resource, returns `201`.
- `PATCH /products/:id`: partially update an existing resource, returns `200`.
- Unknown product: `404`.

## Spring Boot comparison

This maps to a `@PatchMapping("/{id}")` endpoint using a separate update DTO where every editable field is optional.
