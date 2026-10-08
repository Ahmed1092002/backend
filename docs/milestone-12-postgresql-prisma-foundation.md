# Milestone 12: PostgreSQL and Prisma Foundation

## The problem

The existing product array disappears when the Node process restarts. PostgreSQL stores data outside the process so it survives restarts.

## First architecture change

```text
Current
Node.js process -> in-memory array

Foundation added now
Node.js process -> Prisma Client -> PostgreSQL container -> persistent Docker volume
```

The current API still uses the array. The next milestone will deliberately replace that one data-access layer after the database table exists.

## Files

- `docker-compose.yml`: starts PostgreSQL.
- `.env`: local connection string; intentionally ignored by Git.
- `prisma/schema.prisma`: describes the Product table.
- `src/database/prisma.ts`: creates the Prisma client used later by services.

## Why the port is 5433

PostgreSQL uses port `5432` inside its Docker network. The host uses `5433` to avoid colliding with a PostgreSQL server already installed on your machine.
