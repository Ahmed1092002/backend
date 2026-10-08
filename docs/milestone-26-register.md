# Milestone 26: User Registration

## Endpoint

```text
POST /api/auth/register
```

```json
{
  "email": "ahmed@example.com",
  "name": "Ahmed",
  "password": "at-least-8-characters"
}
```

## Flow

```text
JSON body
  -> Zod validates input
  -> Auth service hashes password with bcrypt
  -> User repository creates User
  -> PostgreSQL stores passwordHash and default USER role
  -> mapper removes internal fields
  -> 201 response contains only safe user data
```

## Security rules

- The plain password is never saved to PostgreSQL.
- The response never includes `passwordHash`.
- Duplicate emails return `409 Conflict`.
