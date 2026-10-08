# Milestone 17: Product Search and Price Filtering

## Endpoint

```text
GET /products?search=lap&minPrice=100&maxPrice=1500&page=1&limit=10
```

## Rules

- `search`: case-insensitive partial match against product name.
- `minPrice`: include prices greater than or equal to this amount.
- `maxPrice`: include prices less than or equal to this amount.
- `minPrice` cannot be greater than `maxPrice`.

## Flow

```text
Query parameters
  -> Zod converts text values to numbers and validates them
  -> controller calculates offset from page + limit
  -> repository builds Prisma where + skip + take
  -> PostgreSQL returns matching page and matching total count
```

## Examples

```text
/products?search=lap
/products?minPrice=50&maxPrice=500
/products?search=key&minPrice=10&page=1&limit=5
```
