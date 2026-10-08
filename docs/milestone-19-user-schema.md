# Milestone 19: User Table

## New table

```text
User
  id         UUID primary key
  email      unique text
  name       text
  createdAt  creation timestamp
  updatedAt  automatic update timestamp
```

## Why `@unique` on email?

An email identifies one user in this ERP. PostgreSQL enforces the rule, even if a future API bug attempts to create duplicates.

## What happens next?

The Prisma schema is only a design until a migration applies it to PostgreSQL. The next command generates SQL and executes it against the local Docker database.
