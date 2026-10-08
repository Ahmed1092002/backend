# Milestone 16: Product Pagination

## Problem

Returning every product works for two rows, but becomes slow and expensive for thousands.

## Endpoint

```text
GET /products?offset=0&limit=20
```

## Flow

```text
query string values (text)
  -> Zod converts and validates them
  -> controller asks for one page
  -> repository uses Prisma skip/take
  -> PostgreSQL returns only that page
```

## Response

```json
{
  "data": [],
  "meta": { "total": 2, "offset": 0, "limit": 20 }
}
```

## SQL idea

Prisma's `skip` and `take` are conceptually like PostgreSQL `OFFSET` and `LIMIT`.

```sql
SELECT * FROM "Product"
ORDER BY "createdAt"
OFFSET 0
LIMIT 20;
```

Offset pagination is easy to understand but becomes slower for deep pages. We will later compare it with cursor pagination.
