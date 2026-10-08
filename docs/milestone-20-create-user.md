# Milestone 20: Create User

## Endpoint

```text
POST /users
```

```json
{ "email": "ahmed@example.com", "name": "Ahmed" }
```

## Flow

```text
JSON body
  -> Zod validates email and name
  -> controller
  -> user service
  -> user repository
  -> Prisma
  -> PostgreSQL User table
  -> mapper
  -> UserResponseDto JSON
```

## Errors

- invalid email/name: `400`.
- duplicate email: `409`.

## Why `409`?

`409 Conflict` means the request is valid but conflicts with current server state. A second user cannot use an email already owned by another user.
