# Milestone 13: Products Stored in PostgreSQL

## What changed

The Product service no longer owns an in-memory array. Prisma now reads and writes the PostgreSQL `Product` table.

```text
HTTP request
  -> controller
  -> products service
  -> Prisma Client
  -> PostgreSQL Product table
  -> Prisma maps rows to JavaScript values
  -> JSON response
```

## Why controllers became async

Database work takes time. Node starts the database operation, continues serving other work, and resumes the controller when `await` receives the result.

## Decimal conversion

PostgreSQL `DECIMAL(10,2)` becomes Prisma's Decimal value. The service maps it to a JavaScript number before returning API JSON.

## Seed behavior

`npm run db:seed` uses `upsert`, so it is safe to run repeatedly. It creates or updates the two original sample products instead of duplicating them.
