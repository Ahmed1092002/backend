# Milestone 24: Delete User

## Endpoint

```text
DELETE /api/users/:id
```

## Flow

```text
DELETE request
  -> users controller
  -> users service checks the user exists
  -> users repository deletes through Prisma
  -> PostgreSQL deletes the row
  -> 204 No Content
```

## Current decision

This is a hard delete: the database row is removed. Later, when Orders reference Users, we will decide whether business rules require soft deletion or a database foreign-key restriction.
