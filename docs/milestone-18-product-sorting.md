# Milestone 18: Product Sorting

## Endpoint

```text
GET /products?sortBy=price&sortOrder=desc&page=1&limit=10
```

## Allowed values

- `sortBy`: `id`, `name`, `price`, or `createdAt`; default is `id`.
- `sortOrder`: `asc` or `desc`.

When the client sends no sorting parameters, the API uses `id` ascending.

## Why validate sort fields?

Clients must choose from a known safe list of sortable database columns. The API should not accept arbitrary column names from the URL.

## Prisma idea

```ts
orderBy: { price: "desc" }
```

Prisma translates this into an SQL `ORDER BY` clause.
