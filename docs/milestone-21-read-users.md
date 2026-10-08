# Milestone 21: Read Users

## Endpoints

- `GET /api/users`: return all current users.
- `GET /api/users/:id`: return one user or a JSON 404.

## Flow

```text
GET /api/users/:id
  -> root /api router
  -> users router
  -> users controller
  -> users service
  -> users repository
  -> Prisma User query
  -> mapper
  -> UserResponseDto
```

## Route fallback rule

The global 404 handler is after every valid route. Express only reaches it when no health route or mounted API router matched the request.
